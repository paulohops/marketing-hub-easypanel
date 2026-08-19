-- Eixos adicionais da memória de cálculo: regional e fornecedor.
ALTER TABLE finance_budget_lines ADD COLUMN IF NOT EXISTS "regionalId" integer;
ALTER TABLE finance_budget_lines ADD COLUMN IF NOT EXISTS "supplierId" integer;

DO $$ BEGIN
  ALTER TABLE finance_budget_lines ADD CONSTRAINT finance_budget_lines_regional_fk
    FOREIGN KEY ("regionalId") REFERENCES regionals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE finance_budget_lines ADD CONSTRAINT finance_budget_lines_supplier_fk
    FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS finance_budget_lines_regional_supplier_idx
  ON finance_budget_lines ("regionalId", "supplierId");
