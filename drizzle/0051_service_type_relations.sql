CREATE TABLE "service_type_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceTypeId" integer NOT NULL,
	"subserviceTypeId" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_type_relations" ADD CONSTRAINT "service_type_relations_serviceTypeId_service_types_id_fk" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_type_relations" ADD CONSTRAINT "service_type_relations_subserviceTypeId_service_types_id_fk" FOREIGN KEY ("subserviceTypeId") REFERENCES "public"."service_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_type_relations_uq" ON "service_type_relations" USING btree ("serviceTypeId","subserviceTypeId");