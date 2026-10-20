ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "routeDescription" text;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "distributionVolume" integer;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefStatus" varchar(30);
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefNotes" text;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefRating" integer;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefLearnings" text;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefAt" timestamp with time zone;
ALTER TABLE "media_campaign_schedules" ADD COLUMN IF NOT EXISTS "debriefedByUserId" integer REFERENCES "users"("id") ON DELETE SET NULL;
