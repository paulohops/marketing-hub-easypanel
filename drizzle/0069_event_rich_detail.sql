ALTER TABLE "events" ADD COLUMN "actionPointId" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "resultSummary" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "leadCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "saleCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "renewalCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "positives" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "negatives" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "completedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actionPointId_action_points_id_fk" FOREIGN KEY ("actionPointId") REFERENCES "public"."action_points"("id") ON DELETE set null ON UPDATE no action;
