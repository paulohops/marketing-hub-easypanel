ALTER TABLE "media_points" ADD COLUMN "mediaVariationTypeId" integer;--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN "replacementFrequency" varchar(32);--> statement-breakpoint
ALTER TABLE "media_types" ADD COLUMN "operationCategory" "media_operation_category" DEFAULT 'graphics' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_types" ADD COLUMN "parentMediaTypeId" integer;--> statement-breakpoint
ALTER TABLE "media_points" ADD CONSTRAINT "media_points_mediaVariationTypeId_media_types_id_fk" FOREIGN KEY ("mediaVariationTypeId") REFERENCES "public"."media_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_types" ADD CONSTRAINT "media_types_parentMediaTypeId_media_types_id_fk" FOREIGN KEY ("parentMediaTypeId") REFERENCES "public"."media_types"("id") ON DELETE set null ON UPDATE no action;