DROP INDEX IF EXISTS "commercial_supervisor_stores_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_supervisor_stores_store_uq" ON "commercial_supervisor_stores" USING btree ("storeId");
