ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_created';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_updated';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_status_changed';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_deleted';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'task_assigned';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'task_due';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer,
  "name" varchar(160) NOT NULL,
  "description" text,
  "active" boolean DEFAULT true NOT NULL,
  "createdByUserId" integer,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_companyId_finance_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."finance_companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_categories_company_name_uq" ON "stock_categories" USING btree ("companyId","name") WHERE "companyId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_categories_global_name_uq" ON "stock_categories" USING btree ("name") WHERE "companyId" IS NULL;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "stockCategoryId" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stockCategoryId_stock_categories_id_fk" FOREIGN KEY ("stockCategoryId") REFERENCES "public"."stock_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_items_stock_category_idx" ON "stock_items" USING btree ("stockCategoryId");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(180) NOT NULL,
  "description" text,
  "entityType" varchar(64) NOT NULL,
  "eventType" varchar(64) NOT NULL,
  "titleTemplate" varchar(240) DEFAULT '{{entity}} atualizado' NOT NULL,
  "messageTemplate" text DEFAULT 'O registro {{entity}} #{{entityId}} foi atualizado.' NOT NULL,
  "category" "notification_category" DEFAULT 'entity_updated' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "inAppEnabled" boolean DEFAULT true NOT NULL,
  "emailEnabled" boolean DEFAULT false NOT NULL,
  "excludeActor" boolean DEFAULT true NOT NULL,
  "createdByUserId" integer,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rules_match_uq" ON "notification_rules" USING btree ("entityType","eventType","name");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_rule_recipients" (
  "id" serial PRIMARY KEY NOT NULL,
  "ruleId" integer NOT NULL,
  "userId" integer,
  "regionalId" integer,
  "cityId" integer,
  "companyId" integer,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_ruleId_notification_rules_id_fk" FOREIGN KEY ("ruleId") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_companyId_finance_companies_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."finance_companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_recipients_user_uq" ON "notification_rule_recipients" USING btree ("ruleId","userId") WHERE "userId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_recipients_regional_uq" ON "notification_rule_recipients" USING btree ("ruleId","regionalId") WHERE "regionalId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_recipients_city_uq" ON "notification_rule_recipients" USING btree ("ruleId","cityId") WHERE "cityId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_recipients_company_uq" ON "notification_rule_recipients" USING btree ("ruleId","companyId") WHERE "companyId" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "ruleId" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupeKey" varchar(240);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ruleId_notification_rules_id_fk" FOREIGN KEY ("ruleId") REFERENCES "public"."notification_rules"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_uq" ON "notifications" USING btree ("dedupeKey");--> statement-breakpoint
ALTER TYPE "task_source" ADD VALUE IF NOT EXISTS 'context';--> statement-breakpoint
