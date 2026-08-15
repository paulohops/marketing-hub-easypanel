import { afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const client = connectionString
  ? new Client({ connectionString, ...(process.env.DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } } : {}) })
  : null;

afterAll(async () => {
  await client?.end();
});

describe("integridade persistente do PostgreSQL", () => {
  it.skipIf(!connectionString)("mantém índices únicos para vínculos de fornecedores e campanha ativa", async () => {
    if (!client) return;

    await client.connect();
    const result = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'supplier_cities_uq',
           'supplier_media_types_uq',
           'supplier_service_types_uq',
           'media_campaigns_one_active_per_point_uq'
         )`,
    );
    const indexes = new Map(result.rows.map(row => [row.indexname, row.indexdef]));

    expect(indexes.get("supplier_cities_uq")).toContain("UNIQUE");
    expect(indexes.get("supplier_media_types_uq")).toContain("UNIQUE");
    expect(indexes.get("supplier_service_types_uq")).toContain("UNIQUE");
    expect(indexes.get("media_campaigns_one_active_per_point_uq")).toContain("WHERE (status = 'active'::campaign_status)");
  }, 15_000);
});
