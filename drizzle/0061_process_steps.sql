-- Descritivo estruturado de Processos: vários passos ordenados por setor.
CREATE TABLE IF NOT EXISTS "process_steps" (
  "id" serial PRIMARY KEY NOT NULL,
  "processId" integer NOT NULL,
  "stepOrder" integer NOT NULL,
  "sectorName" varchar(160) NOT NULL,
  "description" text NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "process_steps" ADD CONSTRAINT "process_steps_processId_processes_id_fk" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "process_steps_process_order_idx" ON "process_steps" USING btree ("processId", "stepOrder");
