CREATE TABLE IF NOT EXISTS "product_types" (
  "id" serial PRIMARY KEY,
  "name" varchar(160) NOT NULL UNIQUE,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "paymentBarterValue" numeric(14,2);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "paymentBarterService" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "paymentNotes" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contractStartsOn" date;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contractEndsOn" date;

ALTER TABLE "supplier_offerings" ADD COLUMN IF NOT EXISTS "productTypeId" integer REFERENCES "product_types"("id") ON DELETE SET NULL;
ALTER TABLE "supplier_offerings" ADD COLUMN IF NOT EXISTS "averageUnitPrice" numeric(14,2);
CREATE INDEX IF NOT EXISTS "supplier_offerings_product_type_idx" ON "supplier_offerings" ("productTypeId");
CREATE INDEX IF NOT EXISTS "suppliers_contract_period_idx" ON "suppliers" ("contractStartsOn", "contractEndsOn");
