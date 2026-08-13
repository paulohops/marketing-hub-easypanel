CREATE TABLE "trade_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"objective" text,
	"regionalId" integer,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"status" "campaign_status" DEFAULT 'scheduled' NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD COLUMN "resultSummary" text;--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD COLUMN "leadCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD COLUMN "saleCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD COLUMN "renewalCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "action_services" ADD COLUMN "estimatedAmount" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "tradeCampaignId" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tradeCampaignId" integer;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "tradeCampaignId" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "responsibleCommercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "recipientCommercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "responsibleCommercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "recipientCommercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tradeCampaignId_trade_campaigns_id_fk" FOREIGN KEY ("tradeCampaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tradeCampaignId_trade_campaigns_id_fk" FOREIGN KEY ("tradeCampaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_tradeCampaignId_trade_campaigns_id_fk" FOREIGN KEY ("tradeCampaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_responsibleCommercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("responsibleCommercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_recipientCommercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("recipientCommercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_responsibleCommercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("responsibleCommercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_recipientCommercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("recipientCommercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;