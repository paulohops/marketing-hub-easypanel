CREATE TABLE "provider_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"providerId" integer NOT NULL,
	"title" varchar(180) NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"originalName" varchar(255) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"sizeBytes" integer NOT NULL,
	"uploadedByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_documents_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_providerId_providers_id_fk" FOREIGN KEY ("providerId") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_uploadedByUserId_users_id_fk" FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;