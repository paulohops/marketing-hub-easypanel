CREATE TABLE "commercial_supervisor_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"commercialSupervisorId" integer NOT NULL,
	"cityId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"productTypeId" integer NOT NULL,
	"mediaTypeId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commercial_supervisor_cities" ADD CONSTRAINT "commercial_supervisor_cities_commercialSupervisorId_commercial_supervisors_id_fk" FOREIGN KEY ("commercialSupervisorId") REFERENCES "public"."commercial_supervisors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "commercial_supervisor_cities" ADD CONSTRAINT "commercial_supervisor_cities_cityId_cities_id_fk" FOREIGN KEY ("cityId") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_media_types" ADD CONSTRAINT "product_media_types_productTypeId_product_types_id_fk" FOREIGN KEY ("productTypeId") REFERENCES "public"."product_types"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_media_types" ADD CONSTRAINT "product_media_types_mediaTypeId_media_types_id_fk" FOREIGN KEY ("mediaTypeId") REFERENCES "public"."media_types"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_supervisor_cities_uq" ON "commercial_supervisor_cities" USING btree ("commercialSupervisorId","cityId");
--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_types_uq" ON "product_media_types" USING btree ("productTypeId","mediaTypeId");
