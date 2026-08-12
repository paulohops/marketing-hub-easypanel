CREATE TYPE "public"."permission_action" AS ENUM('read', 'create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."permission_module" AS ENUM('dashboard', 'settings', 'inventory', 'finance', 'media', 'actions', 'events', 'documents', 'map', 'notifications');--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."permission_action" AS ENUM('read', 'create', 'update', 'delete');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."notification_category" ADD VALUE 'stock_minimum';--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "user_role" NOT NULL,
	"module" "permission_module" NOT NULL,
	"action" "permission_action" NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"stockItemId" integer NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_stockItemId_unique" UNIQUE("stockItemId")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_stockItemId_stock_items_id_fk" FOREIGN KEY ("stockItemId") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_module_action_uq" ON "role_permissions" USING btree ("role","module","action");
