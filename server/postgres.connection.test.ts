import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const connectionString = process.env.POSTGRES_URL;
const client = connectionString
  ? new Client({ connectionString, ssl: { rejectUnauthorized: true } })
  : null;

afterAll(async () => {
  await client?.end();
});

describe("PostgreSQL connection", () => {
  it("authenticates and responds to a lightweight health query", async () => {
    expect(connectionString).toBeTruthy();
    if (!client) return;

    await client.connect();
    const result = await client.query<{ ready: number }>("SELECT 1 AS ready");
    const schema = await client.query<{ usersTable: string | null; stockItemsTable: string | null }>(
      "SELECT to_regclass('public.users') AS \"usersTable\", to_regclass('public.stock_items') AS \"stockItemsTable\""
    );

    expect(result.rows[0]?.ready).toBe(1);
    expect(schema.rows[0]?.usersTable).toBe("users");
    expect(schema.rows[0]?.stockItemsTable).toBe("stock_items");
  }, 15_000);
});
