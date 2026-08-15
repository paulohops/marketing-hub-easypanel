ALTER TABLE "providers" ADD COLUMN "headquartersCityId" integer;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "brandColors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cnpjCardStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cnpjCardUrl" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "brandManualStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "brandManualUrl" text;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_headquartersCityId_cities_id_fk" FOREIGN KEY ("headquartersCityId") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;