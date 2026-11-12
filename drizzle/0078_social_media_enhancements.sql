ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "firstComment" text;
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "pilar" varchar(150);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "brand" varchar(50) DEFAULT 'geral';
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "script" text;
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "metaPostId" varchar(255);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_pilar_idx" ON "social_posts" ("pilar");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_brand_idx" ON "social_posts" ("brand");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_meta_id_idx" ON "social_posts" ("metaPostId");
