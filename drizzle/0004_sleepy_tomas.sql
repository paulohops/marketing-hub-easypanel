CREATE TYPE "public"."budget_type" AS ENUM('trade_events', 'branding_b2c');--> statement-breakpoint
CREATE TYPE "public"."operation_cost_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."stock_category" AS ENUM('brinde_relacionamento', 'brinde_vip', 'material_suporte');--> statement-breakpoint
CREATE TYPE "public"."trade_operation_status" AS ENUM('planned', 'approved', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trade_operation_type" AS ENUM('trade_action', 'media', 'event');--> statement-breakpoint
ALTER TYPE "public"."document_entity_type" ADD VALUE 'trade_operation' BEFORE 'invoice';--> statement-breakpoint
ALTER TYPE "public"."financial_operation_type" ADD VALUE 'trade_operation' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "monthly_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"competenceMonth" date NOT NULL,
	"budgetType" "budget_type" NOT NULL,
	"totalAmount" numeric(14, 2) NOT NULL,
	"notes" text,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"operationId" integer NOT NULL,
	"budgetType" "budget_type" NOT NULL,
	"investmentBase" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"permitCost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"storeCost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"otherCosts" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" "operation_cost_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"approvedByUserId" integer,
	"approvedAt" timestamp with time zone,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_costs_operationId_unique" UNIQUE("operationId")
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"sourceStockItemId" integer NOT NULL,
	"destinationStockItemId" integer NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"transferredAt" timestamp with time zone NOT NULL,
	"notes" text,
	"performedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"operationType" "trade_operation_type" NOT NULL,
	"actionTypeId" integer,
	"mediaTypeId" integer,
	"eventTypeId" integer,
	"name" varchar(180) NOT NULL,
	"cityId" integer NOT NULL,
	"supplierId" integer,
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone,
	"status" "trade_operation_status" DEFAULT 'planned' NOT NULL,
	"requiresPermit" boolean DEFAULT false NOT NULL,
	"permitStorageKey" varchar(512),
	"permitUrl" text,
	"postActionFeedback" text,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_items" DROP CONSTRAINT "stock_items_sku_unique";--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "category" "stock_category" DEFAULT 'material_suporte' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatarStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatarUrl" text;--> statement-breakpoint
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_costs" ADD CONSTRAINT "operation_costs_operationId_trade_operations_id_fk" FOREIGN KEY ("operationId") REFERENCES "public"."trade_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_costs" ADD CONSTRAINT "operation_costs_approvedByUserId_users_id_fk" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operation_costs" ADD CONSTRAINT "operation_costs_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_sourceStockItemId_stock_items_id_fk" FOREIGN KEY ("sourceStockItemId") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destinationStockItemId_stock_items_id_fk" FOREIGN KEY ("destinationStockItemId") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_performedByUserId_users_id_fk" FOREIGN KEY ("performedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_actionTypeId_action_types_id_fk" FOREIGN KEY ("actionTypeId") REFERENCES "public"."action_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_mediaTypeId_media_types_id_fk" FOREIGN KEY ("mediaTypeId") REFERENCES "public"."media_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_eventTypeId_event_types_id_fk" FOREIGN KEY ("eventTypeId") REFERENCES "public"."event_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_operations" ADD CONSTRAINT "trade_operations_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_budgets_month_type_uq" ON "monthly_budgets" USING btree ("competenceMonth","budgetType");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_operations_city_name_starts_uq" ON "trade_operations" USING btree ("cityId","name","startsAt");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_items_territory_sku_uq" ON "stock_items" USING btree ("regionalId","cityId","sku");