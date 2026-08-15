import { afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const client = connectionString
  ? new Client({ connectionString, ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } } : {}) })
  : null;

afterAll(async () => {
  await client?.end();
});

describe("PostgreSQL connection", () => {
  it.skipIf(!connectionString)("authenticates and responds to a lightweight health query", async () => {
    if (!client) return;

    await client.connect();
    const result = await client.query<{ ready: number }>("SELECT 1 AS ready");
    const schema = await client.query<{ usersTable: string | null; stockItemsTable: string | null }>(
      "SELECT to_regclass('public.users') AS \"usersTable\", to_regclass('public.stock_items') AS \"stockItemsTable\"",
    );

    expect(result.rows[0]?.ready).toBe(1);
    expect(schema.rows[0]?.usersTable).toBe("users");
    expect(schema.rows[0]?.stockItemsTable).toBe("stock_items");
  }, 15_000);
});
