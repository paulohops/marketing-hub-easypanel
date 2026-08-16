ALTER TABLE "supplier_offerings"
  ADD COLUMN IF NOT EXISTS "mediaTypeId" integer;
ALTER TABLE "supplier_offerings"
  ADD COLUMN IF NOT EXISTS "serviceTypeId" integer;
ALTER TABLE "supplier_service_types"
  ADD COLUMN IF NOT EXISTS "mediaTypeId" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_offerings_mediaTypeId_media_types_id_fk'
  ) THEN
    ALTER TABLE "supplier_offerings"
      ADD CONSTRAINT "supplier_offerings_mediaTypeId_media_types_id_fk"
      FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_offerings_serviceTypeId_service_types_id_fk'
  ) THEN
    ALTER TABLE "supplier_offerings"
      ADD CONSTRAINT "supplier_offerings_serviceTypeId_service_types_id_fk"
      FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_service_types_mediaTypeId_media_types_id_fk'
  ) THEN
    ALTER TABLE "supplier_service_types"
      ADD CONSTRAINT "supplier_service_types_mediaTypeId_media_types_id_fk"
      FOREIGN KEY ("mediaTypeId") REFERENCES "media_types"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "supplier_offerings_service_media_idx"
  ON "supplier_offerings" ("serviceTypeId", "mediaTypeId");
