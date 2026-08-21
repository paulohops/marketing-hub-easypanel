ALTER TABLE "media_campaign_schedules"
  ADD COLUMN IF NOT EXISTS "neighborhoodId" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_campaign_schedules_neighborhood_fk'
  ) THEN
    ALTER TABLE "media_campaign_schedules"
      ADD CONSTRAINT "media_campaign_schedules_neighborhood_fk"
      FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "media_campaign_schedules_uq_v2"
  ON "media_campaign_schedules" ("mediaCampaignId", "programName", "weekday", "specificDate", "neighborhoodId", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "media_campaign_neighborhood_distributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "mediaCampaignId" integer NOT NULL,
  "neighborhoodId" integer NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "notes" text,
  CONSTRAINT "media_campaign_neighborhood_distributions_campaign_fk"
    FOREIGN KEY ("mediaCampaignId") REFERENCES "media_campaigns"("id") ON DELETE CASCADE,
  CONSTRAINT "media_campaign_neighborhood_distributions_neighborhood_fk"
    FOREIGN KEY ("neighborhoodId") REFERENCES "neighborhoods"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_campaign_neighborhood_distributions_uq"
  ON "media_campaign_neighborhood_distributions" ("mediaCampaignId", "neighborhoodId");
CREATE INDEX IF NOT EXISTS "media_campaign_neighborhood_distributions_neighborhood_idx"
  ON "media_campaign_neighborhood_distributions" ("neighborhoodId");

INSERT INTO "media_campaign_neighborhood_distributions" ("mediaCampaignId", "neighborhoodId", "quantity")
SELECT d."mediaCampaignId", n."id", d."quantity"
FROM "media_campaign_city_distributions" d
JOIN "neighborhoods" n ON n."cityId" = d."cityId" AND n."active" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "media_campaign_neighborhood_distributions" existing
  WHERE existing."mediaCampaignId" = d."mediaCampaignId" AND existing."neighborhoodId" = n."id"
);
