CREATE TABLE "campaign_regionals" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"regionalId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_regionals" ADD CONSTRAINT "campaign_regionals_campaignId_trade_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_regionals" ADD CONSTRAINT "campaign_regionals_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_regionals_campaign_regional_uq" ON "campaign_regionals" USING btree ("campaignId","regionalId");