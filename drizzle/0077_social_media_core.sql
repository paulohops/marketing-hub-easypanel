DO $$ BEGIN
  CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'facebook', 'linkedin', 'tiktok', 'google_business');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."social_post_status" AS ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."social_post_type" AS ENUM('feed', 'reel', 'story', 'carousel', 'article', 'gmb_update', 'gmb_offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_accounts" (
  "id" SERIAL PRIMARY KEY,
  "platform" "public"."social_platform" NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountIdentifier" VARCHAR(255) NOT NULL,
  "avatarUrl" TEXT,
  "profileUrl" TEXT,
  "externalId" VARCHAR(255),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMPTZ,
  "settings" TEXT,
  "lastSyncAt" TIMESTAMPTZ,
  "lastSyncStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_accounts_platform_idx" ON "social_accounts" ("platform");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_accounts_active_idx" ON "social_accounts" ("isActive");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255),
  "content" TEXT NOT NULL,
  "postType" "public"."social_post_type" NOT NULL DEFAULT 'feed',
  "mediaUrls" TEXT,
  "status" "public"."social_post_status" NOT NULL DEFAULT 'draft',
  "scheduledFor" TIMESTAMPTZ,
  "publishedAt" TIMESTAMPTZ,
  "campaignId" INTEGER REFERENCES "media_campaigns"("id") ON DELETE SET NULL,
  "targetAccountIds" TEXT NOT NULL DEFAULT '[]',
  "gmbActionUrl" TEXT,
  "gmbActionType" VARCHAR(50),
  "notes" TEXT,
  "createdById" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_posts_status_idx" ON "social_posts" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_scheduled_for_idx" ON "social_posts" ("scheduledFor");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_post_dispatches" (
  "id" SERIAL PRIMARY KEY,
  "postId" INTEGER NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "accountId" INTEGER NOT NULL REFERENCES "social_accounts"("id") ON DELETE CASCADE,
  "status" "public"."social_post_status" NOT NULL DEFAULT 'scheduled',
  "externalPostId" VARCHAR(255),
  "externalPostUrl" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_dispatches_post_idx" ON "social_post_dispatches" ("postId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_dispatches_account_idx" ON "social_post_dispatches" ("accountId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_dispatches_status_idx" ON "social_post_dispatches" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "social_metrics_history" (
  "id" SERIAL PRIMARY KEY,
  "accountId" INTEGER NOT NULL REFERENCES "social_accounts"("id") ON DELETE CASCADE,
  "postId" INTEGER REFERENCES "social_posts"("id") ON DELETE SET NULL,
  "recordedDate" DATE NOT NULL,
  "followersCount" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "engagement" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "videoViews" INTEGER NOT NULL DEFAULT 0,
  "gmbCalls" INTEGER NOT NULL DEFAULT 0,
  "gmbDirectionRequests" INTEGER NOT NULL DEFAULT 0,
  "gmbWebsiteClicks" INTEGER NOT NULL DEFAULT 0,
  "rawPayload" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "social_metrics_account_idx" ON "social_metrics_history" ("accountId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_metrics_date_idx" ON "social_metrics_history" ("recordedDate");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gmb_locations" (
  "id" SERIAL PRIMARY KEY,
  "accountId" INTEGER NOT NULL REFERENCES "social_accounts"("id") ON DELETE CASCADE,
  "storeId" INTEGER REFERENCES "stores"("id") ON DELETE SET NULL,
  "locationName" TEXT NOT NULL,
  "googleLocationId" VARCHAR(255) NOT NULL,
  "address" TEXT,
  "phone" VARCHAR(50),
  "websiteUri" TEXT,
  "regularHours" TEXT,
  "specialHours" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  "latitude" NUMERIC(10, 7),
  "longitude" NUMERIC(10, 7),
  "rating" NUMERIC(3, 2),
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "lastSyncAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gmb_locations_account_idx" ON "gmb_locations" ("accountId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gmb_locations_google_id_idx" ON "gmb_locations" ("googleLocationId");
