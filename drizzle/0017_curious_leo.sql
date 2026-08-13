ALTER TABLE "operation_costs" DROP CONSTRAINT "operation_costs_operationId_unique";--> statement-breakpoint
ALTER TABLE "operation_costs" DROP CONSTRAINT IF EXISTS "operation_costs_operationId_unique";
--> statement-breakpoint
ALTER TABLE "operation_costs" DROP CONSTRAINT "operation_costs_operationId_trade_operations_id_fk";
--> statement-breakpoint
ALTER TABLE "operation_costs" ADD COLUMN "operationType" "financial_operation_type" DEFAULT 'trade_operation' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "operation_costs_type_operation_uq" ON "operation_costs" USING btree ("operationType","operationId");
