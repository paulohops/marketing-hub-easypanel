CREATE TABLE "media_campaign_city_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"mediaCampaignId" integer NOT NULL,
	"cityId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "campaignConfig" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_campaign_city_distributions" ADD CONSTRAINT "media_campaign_city_distributions_mediaCampaignId_media_campaigns_id_fk" FOREIGN KEY ("mediaCampaignId") REFERENCES "public"."media_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaign_city_distributions" ADD CONSTRAINT "media_campaign_city_distributions_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_campaign_city_distributions_uq" ON "media_campaign_city_distributions" USING btree ("mediaCampaignId","cityId");