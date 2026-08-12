INSERT INTO "stock_balances" ("stockItemId", "quantity", "updatedAt")
SELECT
  items."id",
  COALESCE(SUM(CASE WHEN movements."movementType" = 'exit' THEN -movements."quantity"::numeric ELSE movements."quantity"::numeric END), 0)::numeric(14,2),
  now()
FROM "stock_items" AS items
LEFT JOIN "stock_movements" AS movements ON movements."stockItemId" = items."id"
GROUP BY items."id"
ON CONFLICT ("stockItemId") DO NOTHING;
