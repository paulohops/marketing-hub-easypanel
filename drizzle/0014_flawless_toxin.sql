CREATE TABLE "app_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "logoStorageKey" varchar(512);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "logoUrl" text;