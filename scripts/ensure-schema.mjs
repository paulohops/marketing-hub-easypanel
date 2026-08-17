import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ssl = process.env.DATABASE_SSL === "true"
  ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
  : undefined;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória para inicializar ou atualizar o banco.");
}

if (process.env.RUN_MIGRATIONS === "false") {
  console.log("[Database] RUN_MIGRATIONS=false; migrations ignoradas por configuração.");
  process.exit(0);
}

function createPool() {
  return new Pool({ connectionString, ...(ssl ? { ssl } : {}) });
}

const pool = createPool();
try {
  const result = await pool.query(`
    SELECT
      to_regclass('public.users') AS users_table,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema IN ('drizzle', 'public')
          AND table_name = '__drizzle_migrations'
      ) AS migrations_table
  `);

  const usersExist = Boolean(result.rows[0]?.users_table);
  const migrationHistoryExists = Boolean(result.rows[0]?.migrations_table);

  if (!usersExist) {
    console.log("[Database] Primeiro deploy detectado: o schema será criado pelas migrations.");
  } else if (!migrationHistoryExists) {
    throw new Error(
      "O banco já possui a tabela users, mas não possui histórico __drizzle_migrations. " +
      "Nenhuma alteração foi executada para evitar recriar ou sobrescrever o schema. " +
      "Adicione o histórico de migrations antes de continuar.",
    );
  } else {
    console.log("[Database] Schema existente detectado: somente migrations pendentes serão aplicadas.");
  }
} finally {
  await pool.end();
}

const migration = spawnSync("pnpm", ["db:migrate"], {
  stdio: "inherit",
  env: process.env,
});

if (migration.error) throw migration.error;
if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const verificationPool = createPool();
try {
  const requiredUserColumns = [
    "id",
    "openId",
    "name",
    "email",
    "phone",
    "avatarStorageKey",
    "avatarUrl",
    "loginMethod",
    "jobTitle",
    "managerUserId",
    "passwordHash",
    "passwordUpdatedAt",
    "isActive",
    "role",
    "createdAt",
    "updatedAt",
    "lastSignedIn",
  ];
  const columns = await verificationPool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'`,
  );
  const actualColumns = new Set(columns.rows.map(row => row.column_name));
  const missingColumns = requiredUserColumns.filter(column => !actualColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `O schema de users está incompleto. Colunas ausentes: ${missingColumns.join(", ")}. ` +
      "Verifique se DATABASE_URL aponta para o banco correto e se todas as migrations versionadas foram aplicadas.",
    );
  }
  console.log("[Database] Verificação da tabela users concluída.");

  const requiredSchema = {
    suppliers: ["id", "displayName", "document", "phone", "email", "partnershipType", "paymentDay", "contractStartsOn", "contractEndsOn"],
    service_types: ["id", "name", "active", "mediaTypeId", "parentServiceTypeId"],
    media_types: ["id", "name", "active"],
    product_types: ["id", "name", "active"],
    supplier_offerings: ["id", "supplierId", "kind", "name", "unit", "unitPrice", "averageUnitPrice", "productTypeId", "mediaTypeId", "serviceTypeId"],
    supplier_cities: ["supplierId", "cityId"],
    supplier_service_types: ["supplierId", "serviceTypeId", "mediaTypeId"],
    supplier_media_types: ["supplierId", "mediaTypeId"],
  };
  const schemaRows = await verificationPool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredSchema)],
  );
  const actualSchema = new Map();
  for (const row of schemaRows.rows) {
    if (!actualSchema.has(row.table_name)) actualSchema.set(row.table_name, new Set());
    actualSchema.get(row.table_name).add(row.column_name);
  }
  const missingSchema = [];
  for (const [tableName, requiredColumns] of Object.entries(requiredSchema)) {
    const actualColumnsForTable = actualSchema.get(tableName);
    if (!actualColumnsForTable) {
      missingSchema.push(`${tableName} (tabela ausente)`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!actualColumnsForTable.has(column)) missingSchema.push(`${tableName}.${column}`);
    }
  }
  if (missingSchema.length > 0) {
    throw new Error(
      `O schema de parceiros está incompatível com o código. Itens ausentes: ${missingSchema.join(", ")}. ` +
      "Verifique DATABASE_URL e o histórico de migrations; nenhuma alteração manual foi executada.",
    );
  }
  console.log("[Database] Verificação do schema de parceiros concluída.");
} finally {
  await verificationPool.end();
}
