ALTER TYPE "public"."campaign_status" ADD VALUE 'inactive' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "kind" varchar(24) DEFAULT 'evidence' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "serviceTypeId" integer;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "responsibleUserId" integer;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "debriefHistory" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "debriefResult" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "debriefEvaluation" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "debriefLearnings" text;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "debriefAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "contractStartsOn" date;--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "contractEndsOn" date;--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "partnershipType" "partnership_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_responsibleUserId_users_id_fk" FOREIGN KEY ("responsibleUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;