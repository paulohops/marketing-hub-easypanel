-- Núcleo escalável de lançamentos: contratos e OCs podem gerar competências/faturas previstas.
DO $$ BEGIN
  CREATE TYPE finance_recurrence AS ENUM ('one_time', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE finance_billing_status AS ENUM ('planned', 'awaiting_invoice', 'invoiced', 'partially_paid', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE finance_billing_source AS ENUM ('contract', 'purchase_order', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE finance_billing_mode AS ENUM ('single', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "companyId" integer;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "objectDescription" text;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "signatureDate" date;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "billingMode" finance_billing_mode NOT NULL DEFAULT 'recurring';
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "billingRecurrence" finance_recurrence NOT NULL DEFAULT 'monthly';
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "billingStartsOn" date;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "billingEndsOn" date;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "autoRenew" boolean NOT NULL DEFAULT false;
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "bankName" varchar(120);
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "bankBranch" varchar(40);
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "bankAccount" varchar(80);
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "bankHolder" varchar(180);
ALTER TABLE supplier_contracts ADD COLUMN IF NOT EXISTS "pixKey" varchar(180);

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "billingMode" finance_billing_mode NOT NULL DEFAULT 'single';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "billingRecurrence" finance_recurrence NOT NULL DEFAULT 'one_time';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "billingStartsOn" date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "billingEndsOn" date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "paymentDay" integer;

DO $$ BEGIN
  ALTER TABLE supplier_contracts ADD CONSTRAINT supplier_contracts_company_fk
    FOREIGN KEY ("companyId") REFERENCES finance_companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE supplier_contracts ADD CONSTRAINT supplier_contracts_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance_billings (
  id serial PRIMARY KEY,
  source finance_billing_source NOT NULL,
  "supplierContractId" integer REFERENCES supplier_contracts(id) ON DELETE CASCADE,
  "purchaseOrderId" integer REFERENCES purchase_orders(id) ON DELETE CASCADE,
  "companyId" integer REFERENCES finance_companies(id) ON DELETE SET NULL,
  "fiscalEntityId" integer REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL,
  "billingCode" varchar(120) NOT NULL UNIQUE,
  sequence integer NOT NULL DEFAULT 1,
  "competenceStart" date NOT NULL,
  "competenceEnd" date NOT NULL,
  "dueDate" date NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0.00,
  status finance_billing_status NOT NULL DEFAULT 'planned',
  description varchar(240) NOT NULL,
  notes text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_billings_source_owner_ck CHECK (
    (source = 'contract' AND "supplierContractId" IS NOT NULL AND "purchaseOrderId" IS NULL)
    OR (source = 'purchase_order' AND "purchaseOrderId" IS NOT NULL AND "supplierContractId" IS NULL)
    OR (source = 'manual' AND "supplierContractId" IS NULL AND "purchaseOrderId" IS NULL)
  )
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "billingId" integer;
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_billing_fk
    FOREIGN KEY ("billingId") REFERENCES finance_billings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS finance_billings_contract_sequence_uq
  ON finance_billings ("supplierContractId", sequence);
CREATE UNIQUE INDEX IF NOT EXISTS finance_billings_order_sequence_uq
  ON finance_billings ("purchaseOrderId", sequence);
CREATE INDEX IF NOT EXISTS finance_billings_due_status_idx
  ON finance_billings ("dueDate", status);
CREATE INDEX IF NOT EXISTS finance_billings_company_fiscal_idx
  ON finance_billings ("companyId", "fiscalEntityId", "dueDate");
CREATE INDEX IF NOT EXISTS invoices_billing_idx ON invoices ("billingId");
CREATE INDEX IF NOT EXISTS supplier_contracts_company_fiscal_idx
  ON supplier_contracts ("companyId", "fiscalEntityId", status);
CREATE INDEX IF NOT EXISTS purchase_orders_billing_idx
  ON purchase_orders ("billingMode", "billingRecurrence", status);

CREATE TABLE IF NOT EXISTS supplier_contract_items (
  id serial PRIMARY KEY,
  "supplierContractId" integer NOT NULL REFERENCES supplier_contracts(id) ON DELETE CASCADE,
  kind purchase_order_item_kind NOT NULL,
  description varchar(240) NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit varchar(40) NOT NULL,
  "unitPrice" numeric(14,2) NOT NULL,
  "totalAmount" numeric(14,2) NOT NULL,
  "supplierOfferingId" integer REFERENCES supplier_offerings(id) ON DELETE SET NULL,
  "stockItemId" integer REFERENCES stock_items(id) ON DELETE SET NULL,
  "operationType" financial_operation_type,
  "operationId" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_contract_items_contract_idx ON supplier_contract_items ("supplierContractId");
