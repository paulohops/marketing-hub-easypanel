import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const ssl =
  process.env.DATABASE_SSL === "true"
    ? {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
      }
    : undefined;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL é obrigatória para inicializar ou atualizar o banco."
  );
}

if (process.env.RUN_MIGRATIONS === "false") {
  console.log(
    "[Database] RUN_MIGRATIONS=false; migrations ignoradas por configuração."
  );
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
    console.log(
      "[Database] Primeiro deploy detectado: o schema será criado pelas migrations."
    );
  } else if (!migrationHistoryExists) {
    throw new Error(
      "O banco já possui a tabela users, mas não possui histórico __drizzle_migrations. " +
        "Nenhuma alteração foi executada para evitar recriar ou sobrescrever o schema. " +
        "Adicione o histórico de migrations antes de continuar."
    );
  } else {
    console.log(
      "[Database] Schema existente detectado: somente migrations pendentes serão aplicadas."
    );
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
  await verificationPool.query(`
    DO $migration$
    BEGIN
      -- Enum values added by migrations are usable only after Drizzle commits.
      -- Run the dependent seed and default repair in this separate connection.
      IF EXISTS (
        SELECT 1
        FROM pg_enum enum_value
        JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
        WHERE enum_type.typname = 'permission_module'
          AND enum_value.enumlabel = 'operations'
      ) AND to_regclass('public.role_permissions') IS NOT NULL THEN
        EXECUTE $seed$
          INSERT INTO "role_permissions" ("role", "module", "action", "allowed")
          SELECT
            role_value::"user_role",
            'operations'::"permission_module",
            action_value::"permission_action",
            CASE
              WHEN role_value = 'admin' THEN true
              WHEN role_value = 'regional_manager' AND action_value IN ('read', 'create', 'update') THEN true
              WHEN role_value = 'operator' AND action_value IN ('read', 'create', 'update') THEN true
              WHEN role_value IN ('viewer', 'user') AND action_value = 'read' THEN true
              ELSE false
            END
          FROM (VALUES ('admin'), ('regional_manager'), ('operator'), ('viewer'), ('user')) AS roles(role_value)
          CROSS JOIN (VALUES ('read'), ('create'), ('update'), ('delete')) AS actions(action_value)
          ON CONFLICT ("role", "module", "action") DO NOTHING
        $seed$;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_enum enum_value
        JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
        WHERE enum_type.typname = 'notification_category'
          AND enum_value.enumlabel = 'entity_updated'
      ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notification_rules'
          AND column_name = 'category'
      ) THEN
        EXECUTE $default$
          ALTER TABLE "notification_rules"
          ALTER COLUMN "category" SET DEFAULT 'entity_updated'::"notification_category"
        $default$;
      END IF;
    END $migration$;
  `);
  console.log("[Database] Compatibilidade pós-migration verificada.");

  await verificationPool.query(`
    CREATE TABLE IF NOT EXISTS "media_campaign_schedules" (
      "id" SERIAL PRIMARY KEY,
      "mediaCampaignId" INTEGER NOT NULL REFERENCES "media_campaigns"("id") ON DELETE CASCADE,
      "programName" VARCHAR(180) NOT NULL,
      "weekday" INTEGER,
      "specificDate" DATE,
      "startsAt" VARCHAR(5) NOT NULL,
      "endsAt" VARCHAR(5) NOT NULL,
      "notes" TEXT,
      "createdByUserId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "media_campaign_schedules_uq"
      ON "media_campaign_schedules" ("mediaCampaignId", "programName", "weekday", "specificDate", "startsAt", "endsAt");
  `);
  console.log("[Database] Tabela de programação tradicional verificada.");

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
      WHERE table_schema = 'public' AND table_name = 'users'`
  );
  const actualColumns = new Set(columns.rows.map(row => row.column_name));
  const missingColumns = requiredUserColumns.filter(
    column => !actualColumns.has(column)
  );
  if (missingColumns.length > 0) {
    throw new Error(
      `O schema de users está incompleto. Colunas ausentes: ${missingColumns.join(", ")}. ` +
        "Verifique se DATABASE_URL aponta para o banco correto e se todas as migrations versionadas foram aplicadas."
    );
  }
  console.log("[Database] Verificação da tabela users concluída.");

  const requiredSchema = {
    suppliers: [
      "id",
      "displayName",
      "document",
      "phone",
      "email",
      "partnershipType",
      "paymentDay",
      "contractStartsOn",
      "contractEndsOn",
    ],
    service_types: [
      "id",
      "name",
      "active",
      "mediaTypeId",
      "parentServiceTypeId",
    ],
    media_types: ["id", "name", "active"],
    product_types: ["id", "name", "active"],
    supplier_offerings: [
      "id",
      "supplierId",
      "kind",
      "name",
      "unit",
      "unitPrice",
      "averageUnitPrice",
      "productTypeId",
      "mediaTypeId",
      "serviceTypeId",
    ],
    supplier_cities: ["supplierId", "cityId"],
    supplier_service_types: ["supplierId", "serviceTypeId", "mediaTypeId"],
    supplier_media_types: ["supplierId", "mediaTypeId"],
    commercial_supervisor_cities: ["id", "commercialSupervisorId", "cityId"],
    product_media_types: ["id", "productTypeId", "mediaTypeId"],
    media_campaign_schedules: ["id", "mediaCampaignId", "programName", "weekday", "specificDate", "startsAt", "endsAt", "notes", "createdByUserId", "createdAt", "updatedAt"],
  };
  const schemaRows = await verificationPool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [Object.keys(requiredSchema)]
  );
  const actualSchema = new Map();
  for (const row of schemaRows.rows) {
    if (!actualSchema.has(row.table_name))
      actualSchema.set(row.table_name, new Set());
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
      if (!actualColumnsForTable.has(column))
        missingSchema.push(`${tableName}.${column}`);
    }
  }
  if (missingSchema.length > 0) {
    throw new Error(
      `O schema de parceiros está incompatível com o código. Itens ausentes: ${missingSchema.join(", ")}. ` +
        "Verifique DATABASE_URL e o histórico de migrations; nenhuma alteração manual foi executada."
    );
  }
  console.log("[Database] Verificação do schema de parceiros concluída.");
} finally {
  await verificationPool.end();
}
