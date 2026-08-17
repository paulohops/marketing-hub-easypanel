ALTER TABLE "service_types"
  ADD COLUMN IF NOT EXISTS "mediaTypeId" integer,
  ADD COLUMN IF NOT EXISTS "parentServiceTypeId" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_types_mediaTypeId_media_types_id_fk'
  ) THEN
    ALTER TABLE "service_types"
      ADD CONSTRAINT "service_types_mediaTypeId_media_types_id_fk"
      FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_types_parentServiceTypeId_service_types_id_fk'
  ) THEN
    ALTER TABLE "service_types"
      ADD CONSTRAINT "service_types_parentServiceTypeId_service_types_id_fk"
      FOREIGN KEY ("parentServiceTypeId") REFERENCES "service_types"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "service_types_media_type_idx" ON "service_types" ("mediaTypeId");
CREATE INDEX IF NOT EXISTS "service_types_parent_idx" ON "service_types" ("parentServiceTypeId");
