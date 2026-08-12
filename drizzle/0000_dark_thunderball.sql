CREATE TYPE "public"."campaign_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."document_entity_type" AS ENUM('media_campaign', 'action', 'event', 'invoice', 'stock', 'regional_media');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('open', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."media_point_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('entry', 'exit', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('campaign_expiry', 'payment_due', 'action_pending');--> statement-breakpoint
CREATE TYPE "public"."operation_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."financial_operation_type" AS ENUM('media_campaign', 'action', 'event', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'regional_manager', 'operator', 'viewer');--> statement-breakpoint
CREATE TABLE "action_debriefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" integer NOT NULL,
	"rating" integer NOT NULL,
	"notes" text,
	"positives" text,
	"negatives" text,
	"resultAchieved" boolean,
	"completedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "action_debriefs_actionId_unique" UNIQUE("actionId")
);
--> statement-breakpoint
CREATE TABLE "action_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" integer NOT NULL,
	"serviceTypeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" integer NOT NULL,
	"supplierId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "action_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cityId" integer NOT NULL,
	"actionTypeId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"scheduledFor" timestamp with time zone NOT NULL,
	"objective" text NOT NULL,
	"status" "operation_status" DEFAULT 'planned' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer,
	"regionalId" integer,
	"entityType" varchar(64) NOT NULL,
	"entityId" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"beforeData" text,
	"afterData" text,
	"occurredAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"regionalId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"state" varchar(2) NOT NULL,
	"ibgeCode" varchar(16),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"regionalId" integer,
	"entityType" "document_entity_type" NOT NULL,
	"entityId" integer NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"originalName" varchar(255) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"sizeBytes" integer NOT NULL,
	"uploadedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
CREATE TABLE "event_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"supplierId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "event_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"cityId" integer NOT NULL,
	"eventTypeId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"startsAt" timestamp with time zone NOT NULL,
	"endsAt" timestamp with time zone,
	"status" "operation_status" DEFAULT 'planned' NOT NULL,
	"preEventNotes" text,
	"postEventNotes" text,
	"rating" integer,
	"resultAchieved" boolean,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"invoiceNumber" varchar(80) NOT NULL,
	"issueDate" date NOT NULL,
	"dueDate" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"operationType" "financial_operation_type",
	"operationId" integer,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"mediaPointId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"startsOn" date NOT NULL,
	"endsOn" date NOT NULL,
	"notes" text,
	"rating" integer,
	"resultAchieved" boolean,
	"feedback" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"cityId" integer NOT NULL,
	"mediaTypeId" integer NOT NULL,
	"serviceTypeId" integer,
	"name" varchar(180) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"status" "media_point_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "media_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"regionalId" integer,
	"category" "notification_category" NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"entityType" varchar(64),
	"entityId" integer,
	"readAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"legalName" varchar(220),
	"document" varchar(32),
	"contactName" varchar(160),
	"phone" varchar(32),
	"email" varchar(320),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_document_unique" UNIQUE("document")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoiceId" integer NOT NULL,
	"paidAt" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" varchar(80) NOT NULL,
	"reference" varchar(140),
	"notes" text,
	"performedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "regionals" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer,
	"name" varchar(160) NOT NULL,
	"code" varchar(32) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regionals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "service_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"regionalId" integer NOT NULL,
	"cityId" integer,
	"sku" varchar(64) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"unit" varchar(24) DEFAULT 'un' NOT NULL,
	"minimumQuantity" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"stockItemId" integer NOT NULL,
	"movementType" "stock_movement_type" NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unitCost" numeric(14, 2),
	"occurredAt" timestamp with time zone NOT NULL,
	"reference" varchar(120),
	"notes" text,
	"performedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"cityId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(32) NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "supplier_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"cityId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_media_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"mediaTypeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_service_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"serviceTypeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer,
	"displayName" varchar(180) NOT NULL,
	"legalName" varchar(220),
	"document" varchar(32),
	"contactName" varchar(160),
	"phone" varchar(32),
	"email" varchar(320),
	"paymentMethod" varchar(80),
	"pixKey" varchar(220),
	"paymentDay" integer,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_document_unique" UNIQUE("document")
);
--> statement-breakpoint
CREATE TABLE "user_regionals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"regionalId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "action_debriefs" ADD CONSTRAINT "action_debriefs_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_services" ADD CONSTRAINT "action_services_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_services" ADD CONSTRAINT "action_services_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_suppliers" ADD CONSTRAINT "action_suppliers_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_suppliers" ADD CONSTRAINT "action_suppliers_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_actionTypeId_action_types_id_fk" FOREIGN KEY ("actionTypeId") REFERENCES "public"."action_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_users_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_suppliers" ADD CONSTRAINT "event_suppliers_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_suppliers" ADD CONSTRAINT "event_suppliers_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_eventTypeId_event_types_id_fk" FOREIGN KEY ("eventTypeId") REFERENCES "public"."event_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_mediaPointId_media_points_id_fk" FOREIGN KEY ("mediaPointId") REFERENCES "public"."media_points"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_points" ADD CONSTRAINT "media_points_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_points" ADD CONSTRAINT "media_points_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_points" ADD CONSTRAINT "media_points_mediaTypeId_media_types_id_fk" FOREIGN KEY ("mediaTypeId") REFERENCES "public"."media_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_points" ADD CONSTRAINT "media_points_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_invoices_id_fk" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_performedByUserId_users_id_fk" FOREIGN KEY ("performedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regionals" ADD CONSTRAINT "regionals_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stockItemId_stock_items_id_fk" FOREIGN KEY ("stockItemId") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performedByUserId_users_id_fk" FOREIGN KEY ("performedByUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_cities" ADD CONSTRAINT "supplier_cities_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_cities" ADD CONSTRAINT "supplier_cities_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_media_types" ADD CONSTRAINT "supplier_media_types_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_media_types" ADD CONSTRAINT "supplier_media_types_mediaTypeId_media_types_id_fk" FOREIGN KEY ("mediaTypeId") REFERENCES "public"."media_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_service_types" ADD CONSTRAINT "supplier_service_types_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_service_types" ADD CONSTRAINT "supplier_service_types_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regionals" ADD CONSTRAINT "user_regionals_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regionals" ADD CONSTRAINT "user_regionals_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "public"."regionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_services_uq" ON "action_services" USING btree ("actionId","serviceTypeId");--> statement-breakpoint
CREATE UNIQUE INDEX "action_suppliers_uq" ON "action_suppliers" USING btree ("actionId","supplierId");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_regional_name_state_uq" ON "cities" USING btree ("regionalId","name","state");--> statement-breakpoint
CREATE UNIQUE INDEX "event_suppliers_uq" ON "event_suppliers" USING btree ("eventId","supplierId");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_supplier_number_uq" ON "invoices" USING btree ("supplierId","invoiceNumber");--> statement-breakpoint
CREATE UNIQUE INDEX "media_campaigns_one_active_per_point_uq" ON "media_campaigns" USING btree ("mediaPointId") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "regionals_provider_name_uq" ON "regionals" USING btree ("providerId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_cities_uq" ON "supplier_cities" USING btree ("supplierId","cityId");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_media_types_uq" ON "supplier_media_types" USING btree ("supplierId","mediaTypeId");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_service_types_uq" ON "supplier_service_types" USING btree ("supplierId","serviceTypeId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_regionals_uq" ON "user_regionals" USING btree ("userId","regionalId");