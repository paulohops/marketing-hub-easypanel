CREATE TABLE IF NOT EXISTS "neighborhoods" (
  "id" serial PRIMARY KEY NOT NULL,
  "cityId" integer NOT NULL,
  "name" varchar(160) NOT NULL,
  "code" varchar(32),
  "active" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'neighborhoods_city_id_cities_id_fk'
  ) THEN
    ALTER TABLE "neighborhoods"
      ADD CONSTRAINT "neighborhoods_city_id_cities_id_fk"
      FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "neighborhoods_city_name_uq"
  ON "neighborhoods" ("cityId", "name");
CREATE INDEX IF NOT EXISTS "neighborhoods_city_active_idx"
  ON "neighborhoods" ("cityId", "active");

UPDATE "media_types" AS child
SET "operationCategory" = parent."operationCategory"
FROM "media_types" AS parent
WHERE child."parentMediaTypeId" = parent."id"
  AND child."operationCategory" <> parent."operationCategory";
