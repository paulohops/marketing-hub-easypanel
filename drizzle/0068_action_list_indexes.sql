CREATE INDEX IF NOT EXISTS "actions_scheduled_for_idx" ON "actions" ("scheduledFor", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_status_scheduled_for_idx" ON "actions" ("status", "scheduledFor", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_city_scheduled_for_idx" ON "actions" ("cityId", "scheduledFor", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_supervisor_scheduled_for_idx" ON "actions" ("commercialSupervisorId", "scheduledFor", "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "actions_campaign_scheduled_for_idx" ON "actions" ("tradeCampaignId", "scheduledFor", "id");

ALTER TABLE "actions" ADD CONSTRAINT "actions_ends_after_start_chk" CHECK ("endsAt" IS NULL OR "endsAt" >= "scheduledFor");
--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD CONSTRAINT "action_debriefs_rating_chk" CHECK ("rating" BETWEEN 1 AND 5);
