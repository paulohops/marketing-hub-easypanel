CREATE TYPE "public"."media_channel_kind" AS ENUM('standard', 'external');--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'scheduled' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "user_trello_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"boardUrl" text NOT NULL,
	"assignedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_trello_boards_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "partnershipType" "partnership_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "campaignDetails" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "rescheduleReason" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "rescheduledFromCampaignId" integer;--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "channelKind" "media_channel_kind" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_trello_boards" ADD CONSTRAINT "user_trello_boards_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_trello_boards" ADD CONSTRAINT "user_trello_boards_assignedByUserId_users_id_fk" FOREIGN KEY ("assignedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_rescheduledFromCampaignId_media_campaigns_id_fk" FOREIGN KEY ("rescheduledFromCampaignId") REFERENCES "public"."media_campaigns"("id") ON DELETE set null ON UPDATE no action;