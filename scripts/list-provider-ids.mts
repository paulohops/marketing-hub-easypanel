import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: true },
});

try {
  const result = await pool.query<{ id: number; name: string }>("select id, name from providers order by id asc");
  console.table(result.rows);
} finally {
  await pool.end();
}
