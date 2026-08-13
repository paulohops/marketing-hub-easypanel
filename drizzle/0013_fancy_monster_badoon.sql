ALTER TABLE "partners" ADD COLUMN "cityId" integer;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "partnershipType" "partnership_type";--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "paymentMethod" varchar(80);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "paymentRecurrence" varchar(80);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "hasContract" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "contractStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "contractUrl" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "cityId" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "partnershipType" "partnership_type";--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "paymentRecurrence" varchar(80);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "hasContract" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contractStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "contractUrl" text;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;