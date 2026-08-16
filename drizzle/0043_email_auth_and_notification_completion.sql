ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authCodeHash" varchar(128);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authCodePurpose" varchar(32);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authCodeExpiresAt" timestamptz;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "completedAt" timestamptz;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "completedByUserId" integer;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actionUrl" text;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actionLabel" varchar(120);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_completedByUserId_users_id_fk'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_completedByUserId_users_id_fk"
      FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notifications_completed_at_idx" ON "notifications" USING btree ("completedAt");
CREATE INDEX IF NOT EXISTS "notifications_completed_by_user_idx" ON "notifications" USING btree ("completedByUserId");
