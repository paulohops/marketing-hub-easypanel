CREATE TABLE "campaign_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"cityId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_promotion_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignPromotionId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(48) DEFAULT 'unidade' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_template_promotion_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignTemplatePromotionId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"unit" varchar(48) DEFAULT 'unidade' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_template_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignTemplateId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"objective" text,
	"defaultStatus" "campaign_status" DEFAULT 'scheduled' NOT NULL,
	"defaultDurationDays" integer,
	"logoStorageKey" varchar(512),
	"logoUrl" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "providerId" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "campaignTemplateId" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "logoStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "logoUrl" text;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "debriefRating" integer;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "debriefNotes" text;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "debriefResult" text;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD COLUMN "debriefAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaign_cities" ADD CONSTRAINT "campaign_cities_campaignId_trade_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_cities" ADD CONSTRAINT "campaign_cities_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_promotion_plans" ADD CONSTRAINT "campaign_promotion_plans_campaignPromotionId_campaign_promotions_id_fk" FOREIGN KEY ("campaignPromotionId") REFERENCES "public"."campaign_promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_promotions" ADD CONSTRAINT "campaign_promotions_campaignId_trade_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."trade_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_template_promotion_plans" ADD CONSTRAINT "campaign_template_promotion_plans_campaignTemplatePromotionId_campaign_template_promotions_id_fk" FOREIGN KEY ("campaignTemplatePromotionId") REFERENCES "public"."campaign_template_promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_template_promotions" ADD CONSTRAINT "campaign_template_promotions_campaignTemplateId_campaign_templates_id_fk" FOREIGN KEY ("campaignTemplateId") REFERENCES "public"."campaign_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_cities_campaign_city_uq" ON "campaign_cities" USING btree ("campaignId","cityId");--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_campaigns" ADD CONSTRAINT "trade_campaigns_campaignTemplateId_campaign_templates_id_fk" FOREIGN KEY ("campaignTemplateId") REFERENCES "public"."campaign_templates"("id") ON DELETE set null ON UPDATE no action;