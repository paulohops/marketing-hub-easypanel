CREATE TYPE "public"."supplier_offering_kind" AS ENUM('service', 'media', 'action', 'event', 'other');--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "supplier_offerings" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"kind" "supplier_offering_kind" NOT NULL,
	"name" varchar(180) NOT NULL,
	"unit" varchar(64) DEFAULT 'unidade' NOT NULL,
	"unitPrice" numeric(14, 2) NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"module" "permission_module" NOT NULL,
	"action" "permission_action" NOT NULL,
	"allowed" boolean NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "jobTitle" varchar(120);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordUpdatedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "isActive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_offerings" ADD CONSTRAINT "supplier_offerings_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_offerings_supplier_kind_name_uq" ON "supplier_offerings" USING btree ("supplierId","kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "user_permissions_user_module_action_uq" ON "user_permissions" USING btree ("userId","module","action");