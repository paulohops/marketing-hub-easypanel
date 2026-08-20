-- Metadados BPMN dos passos de Processos.
-- A migração é incremental porque 0061 já criou a tabela process_steps com o núcleo do descritivo.
DO $$ BEGIN
  CREATE TYPE "process_step_type" AS ENUM ('task', 'gateway');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "process_steps"
  ADD COLUMN IF NOT EXISTS "sectorId" integer,
  ADD COLUMN IF NOT EXISTS "stepType" "process_step_type" DEFAULT 'task' NOT NULL,
  ADD COLUMN IF NOT EXISTS "stepName" varchar(180) DEFAULT 'Etapa operacional' NOT NULL,
  ADD COLUMN IF NOT EXISTS "gatewayQuestion" text,
  ADD COLUMN IF NOT EXISTS "yesNextStepOrder" integer,
  ADD COLUMN IF NOT EXISTS "noNextStepOrder" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_sectorId_campaign_sectors_id_fk"
    FOREIGN KEY ("sectorId") REFERENCES "campaign_sectors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_steps_sector_idx" ON "process_steps" USING btree ("sectorId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_steps_process_order_idx" ON "process_steps" USING btree ("processId", "stepOrder");
