ALTER TABLE "cities" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "zipCode" varchar(16);--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "locationNotes" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "legalName" varchar(220);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "billingCnpj" varchar(32);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "contactName" varchar(160);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "email" varchar(320);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "updatedAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_billingCnpj_unique" UNIQUE("billingCnpj");