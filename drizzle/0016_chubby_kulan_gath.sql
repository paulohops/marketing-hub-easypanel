ALTER TYPE "public"."user_role" ADD VALUE 'team_member' BEFORE 'admin';--> statement-breakpoint
CREATE TABLE "action_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"cityId" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_supervisor_stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"commercialSupervisorId" integer NOT NULL,
	"storeId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_module_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"module" "permission_module" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "actionPointId" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "managerUserId" integer;--> statement-breakpoint
ALTER TABLE "action_points" ADD CONSTRAINT "action_points_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_supervisor_stores" ADD CONSTRAINT "commercial_supervisor_stores_commercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("commercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_supervisor_stores" ADD CONSTRAINT "commercial_supervisor_stores_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_module_settings" ADD CONSTRAINT "user_module_settings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_points_city_name_uq" ON "action_points" USING btree ("cityId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_supervisor_stores_uq" ON "commercial_supervisor_stores" USING btree ("commercialSupervisorId","storeId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_module_settings_user_module_uq" ON "user_module_settings" USING btree ("userId","module");--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_actionPointId_action_points_id_fk" FOREIGN KEY ("actionPointId") REFERENCES "public"."action_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_managerUserId_users_id_fk" FOREIGN KEY ("managerUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;