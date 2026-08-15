import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) throw new Error("POSTGRES_URL is required");

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: true } });

try {
  const columns = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'providers'
      AND column_name IN (
        'headquartersCityId',
        'brandColors',
        'cnpjCardStorageKey',
        'cnpjCardUrl',
        'brandManualStorageKey',
        'brandManualUrl'
      )
    ORDER BY column_name;
  `);
  const constraints = await pool.query<{ conname: string }>(`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'providers_headquartersCityId_cities_id_fk';
  `);
  console.log(JSON.stringify({ columns: columns.rows, constraints: constraints.rows }, null, 2));
} finally {
  await pool.end();
}
