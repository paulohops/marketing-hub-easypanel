CREATE TABLE "campaign_promotion_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignPromotionId" integer NOT NULL,
	"cityId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_promotion_cities" ADD CONSTRAINT "campaign_promotion_cities_campaignPromotionId_campaign_promotions_id_fk" FOREIGN KEY ("campaignPromotionId") REFERENCES "public"."campaign_promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_promotion_cities" ADD CONSTRAINT "campaign_promotion_cities_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_promotion_cities_promotion_city_uq" ON "campaign_promotion_cities" USING btree ("campaignPromotionId","cityId");