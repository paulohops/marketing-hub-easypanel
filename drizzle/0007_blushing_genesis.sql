CREATE TABLE "commercial_supervisors" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"name" varchar(160) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"cityId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "cityId" integer;--> statement-breakpoint
ALTER TABLE "commercial_supervisors" ADD CONSTRAINT "commercial_supervisors_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cities" ADD CONSTRAINT "user_cities_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cities" ADD CONSTRAINT "user_cities_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_cities_uq" ON "user_cities" USING btree ("userId","cityId");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;