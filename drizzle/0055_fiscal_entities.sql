-- Separa a empresa operacional das suas empresas fiscais, permitindo múltiplos CNPJs por empresa.
CREATE TABLE IF NOT EXISTS provider_fiscal_entities (
  id serial PRIMARY KEY,
  "providerId" integer NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  "legalName" varchar(220),
  cnpj varchar(14) NOT NULL UNIQUE,
  "stateRegistration" varchar(80),
  "municipalRegistration" varchar(80),
  address text,
  "cityId" integer REFERENCES cities(id) ON DELETE SET NULL,
  "isDefault" boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_fiscal_entities_provider_name_uq UNIQUE ("providerId", name)
);

ALTER TABLE finance_companies ADD COLUMN IF NOT EXISTS "providerId" integer;
ALTER TABLE finance_companies ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;
ALTER TABLE finance_budget_lines ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "companyId" integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;
ALTER TABLE financial_cost_allocations ADD COLUMN IF NOT EXISTS "fiscalEntityId" integer;

DO $$ BEGIN
  ALTER TABLE finance_companies
    ADD CONSTRAINT finance_companies_provider_fk
    FOREIGN KEY ("providerId") REFERENCES providers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE finance_companies
    ADD CONSTRAINT finance_companies_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE finance_budget_lines
    ADD CONSTRAINT finance_budget_lines_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_orders
    ADD CONSTRAINT purchase_orders_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_company_fk
    FOREIGN KEY ("companyId") REFERENCES finance_companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE invoices
    ADD CONSTRAINT invoices_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE financial_cost_allocations
    ADD CONSTRAINT financial_cost_allocations_fiscal_entity_fk
    FOREIGN KEY ("fiscalEntityId") REFERENCES provider_fiscal_entities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO provider_fiscal_entities ("providerId", name, "legalName", cnpj, "isDefault")
SELECT p.id,
       COALESCE(NULLIF(p."legalName", ''), p.name),
       p."legalName",
       regexp_replace(p."billingCnpj", '\\D', '', 'g'),
       true
FROM providers p
WHERE p."billingCnpj" IS NOT NULL
  AND length(regexp_replace(p."billingCnpj", '\\D', '', 'g')) = 14
  AND NOT EXISTS (
    SELECT 1 FROM provider_fiscal_entities f
    WHERE f.cnpj = regexp_replace(p."billingCnpj", '\\D', '', 'g')
  );

CREATE INDEX IF NOT EXISTS provider_fiscal_entities_provider_idx ON provider_fiscal_entities ("providerId", active);
CREATE INDEX IF NOT EXISTS provider_fiscal_entities_city_idx ON provider_fiscal_entities ("cityId");
CREATE INDEX IF NOT EXISTS finance_companies_provider_idx ON finance_companies ("providerId", active);
CREATE INDEX IF NOT EXISTS finance_budget_lines_fiscal_entity_idx ON finance_budget_lines ("fiscalEntityId");
CREATE INDEX IF NOT EXISTS purchase_orders_fiscal_entity_idx ON purchase_orders ("fiscalEntityId", status);
CREATE INDEX IF NOT EXISTS invoices_fiscal_entity_idx ON invoices ("fiscalEntityId", "dueDate");
CREATE INDEX IF NOT EXISTS financial_cost_allocations_fiscal_entity_idx ON financial_cost_allocations ("fiscalEntityId", "competenceYear", "competenceMonth");
