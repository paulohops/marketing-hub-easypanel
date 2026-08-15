import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: true },
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS provider_documents (
      "id" serial PRIMARY KEY,
      "providerId" integer NOT NULL,
      "title" varchar(180) NOT NULL,
      "storageKey" varchar(512) NOT NULL UNIQUE,
      "url" text NOT NULL,
      "originalName" varchar(255) NOT NULL,
      "mimeType" varchar(120) NOT NULL,
      "sizeBytes" integer NOT NULL,
      "uploadedByUserId" integer,
      "createdAt" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_documents_providerId_providers_id_fk') THEN
        ALTER TABLE provider_documents ADD CONSTRAINT "provider_documents_providerId_providers_id_fk"
        FOREIGN KEY ("providerId") REFERENCES providers(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_documents_uploadedByUserId_users_id_fk') THEN
        ALTER TABLE provider_documents ADD CONSTRAINT "provider_documents_uploadedByUserId_users_id_fk"
        FOREIGN KEY ("uploadedByUserId") REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$
  `);
  console.log("Migração 0037 aplicada com sucesso.");
} finally {
  await pool.end();
}
