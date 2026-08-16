ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "mediaTypeId" integer REFERENCES "media_types"("id") ON DELETE SET NULL;
ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "parentServiceTypeId" integer REFERENCES "service_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_service_types" ADD COLUMN IF NOT EXISTS "mediaTypeId" integer REFERENCES "media_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_offerings" ADD COLUMN IF NOT EXISTS "mediaTypeId" integer REFERENCES "media_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_offerings" ADD COLUMN IF NOT EXISTS "serviceTypeId" integer REFERENCES "service_types"("id") ON DELETE SET NULL;
DROP INDEX IF EXISTS "supplier_service_types_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_service_types_uq" ON "supplier_service_types" ("supplierId", "serviceTypeId", "mediaTypeId");
CREATE INDEX IF NOT EXISTS "service_types_media_parent_idx" ON "service_types" ("mediaTypeId", "parentServiceTypeId");
CREATE INDEX IF NOT EXISTS "supplier_offerings_service_media_idx" ON "supplier_offerings" ("serviceTypeId", "mediaTypeId");

-- Existing service types remain independent services until explicitly linked.
-- A subservice is represented by parentServiceTypeId and may inherit mediaTypeId from its parent.
UPDATE "service_types" AS child
SET "mediaTypeId" = parent."mediaTypeId"
FROM "service_types" AS parent
WHERE child."parentServiceTypeId" = parent."id"
  AND child."mediaTypeId" IS NULL;
