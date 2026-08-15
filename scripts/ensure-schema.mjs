import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória para inicializar ou atualizar o banco.");
}

if (process.env.RUN_MIGRATIONS === "false") {
  console.log("[Database] RUN_MIGRATIONS=false; migrations ignoradas por configuração.");
  process.exit(0);
}

const pool = new Pool({
  connectionString,
  ...(process.env.DATABASE_SSL === "true"
    ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } }
    : {}),
});

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
