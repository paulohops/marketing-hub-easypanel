CREATE TYPE "public"."partnership_type" AS ENUM('paid', 'barter', 'mixed');--> statement-breakpoint
CREATE TABLE "action_stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" integer NOT NULL,
	"stockItemId" integer NOT NULL,
	"plannedQuantity" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"actionId" integer NOT NULL,
	"userId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"serviceTypeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"stockItemId" integer NOT NULL,
	"plannedQuantity" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" integer NOT NULL,
	"userId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "endsAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "commercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "partnershipType" "partnership_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "estimatedCost" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "commercialSupervisorId" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "partnershipType" "partnership_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "estimatedCost" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "partnershipReason" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "worthRenewing" boolean;--> statement-breakpoint
ALTER TABLE "action_stock_items" ADD CONSTRAINT "action_stock_items_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_stock_items" ADD CONSTRAINT "action_stock_items_stockItemId_stock_items_id_fk" FOREIGN KEY ("stockItemId") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_team_members" ADD CONSTRAINT "action_team_members_actionId_actions_id_fk" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_team_members" ADD CONSTRAINT "action_team_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_stock_items" ADD CONSTRAINT "event_stock_items_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_stock_items" ADD CONSTRAINT "event_stock_items_stockItemId_stock_items_id_fk" FOREIGN KEY ("stockItemId") REFERENCES "public"."stock_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_members" ADD CONSTRAINT "event_team_members_eventId_events_id_fk" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_team_members" ADD CONSTRAINT "event_team_members_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_stock_items_uq" ON "action_stock_items" USING btree ("actionId","stockItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "action_team_members_uq" ON "action_team_members" USING btree ("actionId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "event_services_uq" ON "event_services" USING btree ("eventId","serviceTypeId");--> statement-breakpoint
CREATE UNIQUE INDEX "event_stock_items_uq" ON "event_stock_items" USING btree ("eventId","stockItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "event_team_members_uq" ON "event_team_members" USING btree ("eventId","userId");--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_commercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("commercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_commercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("commercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE set null ON UPDATE no action;