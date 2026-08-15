CREATE TABLE "urban_media_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"mediaPointId" integer NOT NULL,
	"mediaVariationTypeId" integer NOT NULL,
	"replacementFrequency" varchar(32) NOT NULL,
	"contractReference" varchar(180),
	"contractValue" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "urbanMediaRegistrationId" integer;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "mediaVariationTypeId" integer;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD COLUMN "objective" varchar(180);--> statement-breakpoint
ALTER TABLE "urban_media_registrations" ADD CONSTRAINT "urban_media_registrations_mediaPointId_media_points_id_fk" FOREIGN KEY ("mediaPointId") REFERENCES "public"."media_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urban_media_registrations" ADD CONSTRAINT "urban_media_registrations_mediaVariationTypeId_media_types_id_fk" FOREIGN KEY ("mediaVariationTypeId") REFERENCES "public"."media_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urban_media_registrations" ADD CONSTRAINT "urban_media_registrations_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "urban_media_registrations_point_variation_uq" ON "urban_media_registrations" USING btree ("mediaPointId","mediaVariationTypeId");--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_urbanMediaRegistrationId_urban_media_registrations_id_fk" FOREIGN KEY ("urbanMediaRegistrationId") REFERENCES "public"."urban_media_registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_campaigns" ADD CONSTRAINT "media_campaigns_mediaVariationTypeId_media_types_id_fk" FOREIGN KEY ("mediaVariationTypeId") REFERENCES "public"."media_types"("id") ON DELETE set null ON UPDATE no action;