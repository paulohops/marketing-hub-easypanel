ALTER TABLE "media_campaign_schedules"
  ADD COLUMN IF NOT EXISTS "cityId" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_campaign_schedules_city_fk'
  ) THEN
    ALTER TABLE "media_campaign_schedules"
      ADD CONSTRAINT "media_campaign_schedules_city_fk"
      FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL;
  END IF;
END $$;
