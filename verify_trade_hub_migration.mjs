import pg from "pg";

const required = ["role_permissions", "stock_balances"];
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: true } });

try {
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY table_name",
    [required],
  );
  console.log(JSON.stringify(rows));
} finally {
  await pool.end();
}
