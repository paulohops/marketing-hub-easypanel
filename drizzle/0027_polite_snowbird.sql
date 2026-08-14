CREATE TABLE "campaign_sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "campaign_sectors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "campaign_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "campaign_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "campaignTypeId" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "campaignSectorId" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_campaignTypeId_campaign_types_id_fk" FOREIGN KEY ("campaignTypeId") REFERENCES "public"."campaign_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_campaignSectorId_campaign_sectors_id_fk" FOREIGN KEY ("campaignSectorId") REFERENCES "public"."campaign_sectors"("id") ON DELETE set null ON UPDATE no action;