-- Núcleo financeiro corporativo: planejamento mensal, pedidos de compra,
-- itens de nota fiscal e apropriação de custos por operação.
DO $$ BEGIN
  CREATE TYPE finance_budget_status AS ENUM ('draft', 'approved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE purchase_order_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'partially_received', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE purchase_order_item_kind AS ENUM ('product', 'service', 'media', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE financial_allocation_method AS ENUM ('manual', 'by_quantity', 'by_percent', 'by_city');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finance_companies (
  id serial PRIMARY KEY,
  name varchar(180) NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_divisions (
  id serial PRIMARY KEY,
  name varchar(180) NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS finance_sectors (
  id serial PRIMARY KEY,
  "divisionId" integer REFERENCES finance_divisions(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS finance_mediums (
  id serial PRIMARY KEY,
  name varchar(180) NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS finance_accounts (
  id serial PRIMARY KEY,
  "mediumId" integer REFERENCES finance_mediums(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  code varchar(40) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS finance_budget_plans (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  name varchar(180) NOT NULL,
  status finance_budget_status NOT NULL DEFAULT 'draft',
  notes text,
  "createdByUserId" integer REFERENCES users(id) ON DELETE RESTRICT,
  "approvedByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "approvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_budget_plans_year_name_uq UNIQUE (year, name)
);
CREATE TABLE IF NOT EXISTS finance_budget_lines (
  id serial PRIMARY KEY,
  "planId" integer NOT NULL REFERENCES finance_budget_plans(id) ON DELETE CASCADE,
  "companyId" integer REFERENCES finance_companies(id) ON DELETE SET NULL,
  "divisionId" integer REFERENCES finance_divisions(id) ON DELETE SET NULL,
  "sectorId" integer REFERENCES finance_sectors(id) ON DELETE SET NULL,
  "mediumId" integer REFERENCES finance_mediums(id) ON DELETE SET NULL,
  "accountId" integer REFERENCES finance_accounts(id) ON DELETE SET NULL,
  "allocationRule" varchar(40) NOT NULL DEFAULT 'manual',
  percentage numeric(8,4),
  "annualAmount" numeric(14,2) NOT NULL DEFAULT 0.00,
  notes text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_budget_months (
  id serial PRIMARY KEY,
  "budgetLineId" integer NOT NULL REFERENCES finance_budget_lines(id) ON DELETE CASCADE,
  month integer NOT NULL,
  "plannedAmount" numeric(14,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT finance_budget_months_line_month_uq UNIQUE ("budgetLineId", month)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id serial PRIMARY KEY,
  "orderNumber" varchar(100) NOT NULL UNIQUE,
  "supplierId" integer NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  "budgetPlanId" integer REFERENCES finance_budget_plans(id) ON DELETE SET NULL,
  "companyId" integer REFERENCES finance_companies(id) ON DELETE SET NULL,
  "divisionId" integer REFERENCES finance_divisions(id) ON DELETE SET NULL,
  "sectorId" integer REFERENCES finance_sectors(id) ON DELETE SET NULL,
  "mediumId" integer REFERENCES finance_mediums(id) ON DELETE SET NULL,
  status purchase_order_status NOT NULL DEFAULT 'draft',
  "requestedAt" timestamptz NOT NULL DEFAULT now(),
  "expectedDeliveryOn" date,
  "totalAmount" numeric(14,2) NOT NULL DEFAULT 0.00,
  notes text,
  "requestedByUserId" integer REFERENCES users(id) ON DELETE RESTRICT,
  "approvedByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "approvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id serial PRIMARY KEY,
  "purchaseOrderId" integer NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  kind purchase_order_item_kind NOT NULL DEFAULT 'service',
  description varchar(240) NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1.00,
  unit varchar(40) NOT NULL DEFAULT 'unidade',
  "unitPrice" numeric(14,2) NOT NULL DEFAULT 0.00,
  "totalAmount" numeric(14,2) NOT NULL DEFAULT 0.00,
  "supplierOfferingId" integer REFERENCES supplier_offerings(id) ON DELETE SET NULL,
  "stockItemId" integer REFERENCES stock_items(id) ON DELETE SET NULL,
  "operationType" financial_operation_type,
  "operationId" integer,
  "receivedQuantity" numeric(12,2) NOT NULL DEFAULT 0.00
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id serial PRIMARY KEY,
  "invoiceId" integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  "purchaseOrderItemId" integer REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  kind purchase_order_item_kind NOT NULL DEFAULT 'service',
  description varchar(240) NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1.00,
  unit varchar(40) NOT NULL DEFAULT 'unidade',
  "unitPrice" numeric(14,2) NOT NULL DEFAULT 0.00,
  "totalAmount" numeric(14,2) NOT NULL DEFAULT 0.00,
  "stockItemId" integer REFERENCES stock_items(id) ON DELETE SET NULL,
  "receivedQuantity" numeric(12,2) NOT NULL DEFAULT 0.00
);
CREATE TABLE IF NOT EXISTS financial_cost_allocations (
  id serial PRIMARY KEY,
  "sourceType" varchar(48) NOT NULL,
  "sourceId" integer NOT NULL,
  "operationType" financial_operation_type,
  "operationId" integer,
  "companyId" integer REFERENCES finance_companies(id) ON DELETE SET NULL,
  "divisionId" integer REFERENCES finance_divisions(id) ON DELETE SET NULL,
  "sectorId" integer REFERENCES finance_sectors(id) ON DELETE SET NULL,
  "mediumId" integer REFERENCES finance_mediums(id) ON DELETE SET NULL,
  "accountId" integer REFERENCES finance_accounts(id) ON DELETE SET NULL,
  "cityId" integer REFERENCES cities(id) ON DELETE SET NULL,
  "allocationMethod" financial_allocation_method NOT NULL DEFAULT 'manual',
  "allocationPercent" numeric(8,4),
  quantity numeric(12,2),
  amount numeric(14,2) NOT NULL,
  "competenceMonth" integer NOT NULL,
  "competenceYear" integer NOT NULL,
  notes text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_status_idx ON purchase_orders ("supplierId", status);
CREATE INDEX IF NOT EXISTS purchase_orders_delivery_idx ON purchase_orders ("expectedDeliveryOn");
CREATE INDEX IF NOT EXISTS finance_budget_months_month_idx ON finance_budget_months (month);
CREATE INDEX IF NOT EXISTS financial_cost_allocations_competence_idx ON financial_cost_allocations ("competenceYear", "competenceMonth");
CREATE INDEX IF NOT EXISTS financial_cost_allocations_operation_idx ON financial_cost_allocations ("operationType", "operationId");
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items ("invoiceId");
