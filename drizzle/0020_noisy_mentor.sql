CREATE TYPE "public"."supplier_contract_status" AS ENUM('draft', 'active', 'expired', 'terminated');--> statement-breakpoint
ALTER TYPE "public"."document_entity_type" ADD VALUE 'supplier_contract';--> statement-breakpoint
CREATE TABLE "supplier_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplierId" integer NOT NULL,
	"purchaseOrderCode" varchar(96),
	"contractType" varchar(120) NOT NULL,
	"contractCode" varchar(120),
	"billingNames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"startsOn" date NOT NULL,
	"endsOn" date,
	"termMonths" integer,
	"recurrence" varchar(80) NOT NULL,
	"paymentDay" integer,
	"expectedAmount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"paymentMethod" varchar(80),
	"status" "supplier_contract_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supplierContractId" integer;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_contracts_supplier_code_uq" ON "supplier_contracts" USING btree ("supplierId","contractCode");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplierContractId_supplier_contracts_id_fk" FOREIGN KEY ("supplierContractId") REFERENCES "public"."supplier_contracts"("id") ON DELETE restrict ON UPDATE no action;