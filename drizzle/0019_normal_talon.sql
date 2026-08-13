ALTER TABLE "stores" ADD COLUMN "referencePoint" varchar(240);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "zipCode" varchar(16);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "email" varchar(320);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "openingHours" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "photoStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "photoUrl" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;