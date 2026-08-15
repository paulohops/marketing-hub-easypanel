CREATE TYPE "public"."influencer_post_status" AS ENUM('planned', 'published', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."media_operation_category" AS ENUM('graphics', 'audio_video', 'leafleting', 'sound_car', 'influencers');--> statement-breakpoint
CREATE TABLE "influencer_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"influencerGroupId" integer NOT NULL,
	"influencerId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"weekday" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"influencerId" integer NOT NULL,
	"influencerGroupId" integer,
	"tradeCampaignId" integer,
	"scheduledFor" timestamp with time zone NOT NULL,
	"platform" varchar(80),
	"deliverable" text,
	"status" "influencer_post_status" DEFAULT 'planned' NOT NULL,
	"publicationConfirmed" boolean DEFAULT false NOT NULL,
	"publishedAt" timestamp with time zone,
	"evidenceUrls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"phone" varchar(32),
	"email" varchar(320),
	"socialHandle" varchar(180),
	"profileImageUrl" text,
	"paymentMethod" varchar(80),
	"paymentFrequency" varchar(80),
	"paymentDay" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_spots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"storageKey" varchar(512),
	"url" text,
	"mimeType" varchar(120),
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_car_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"mediaCampaignId" integer NOT NULL,
	"drivenOn" date NOT NULL,
	"startsAt" varchar(5),
	"endsAt" varchar(5),
	"route" text,
	"notes" text,
	"evidenceUrls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "operationCategory" "media_operation_category" DEFAULT 'graphics' NOT NULL;--> statement-breakpoint
ALTER TABLE "influencer_group_members" ADD CONSTRAINT "influencer_group_members_influencerGroupId_influencer_groups_id_fk" FOREIGN KEY ("influencerGroupId") REFERENCES "public"."influencer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_group_members" ADD CONSTRAINT "influencer_group_members_influencerId_influencers_id_fk" FOREIGN KEY ("influencerId") REFERENCES "public"."influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_posts" ADD CONSTRAINT "influencer_posts_influencerId_influencers_id_fk" FOREIGN KEY ("influencerId") REFERENCES "public"."influencers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_posts" ADD CONSTRAINT "influencer_posts_influencerGroupId_influencer_groups_id_fk" FOREIGN KEY ("influencerGroupId") REFERENCES "public"."influencer_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_posts" ADD CONSTRAINT "influencer_posts_tradeCampaignId_trade_campaigns_id_fk" FOREIGN KEY ("tradeCampaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_spots" ADD CONSTRAINT "media_spots_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_car_runs" ADD CONSTRAINT "sound_car_runs_mediaCampaignId_media_campaigns_id_fk" FOREIGN KEY ("mediaCampaignId") REFERENCES "public"."media_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_car_runs" ADD CONSTRAINT "sound_car_runs_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "influencer_group_members_uq" ON "influencer_group_members" USING btree ("influencerGroupId","influencerId");