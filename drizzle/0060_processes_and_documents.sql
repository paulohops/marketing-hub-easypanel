-- Central de Conhecimento: processos operacionais e arquivos oficiais.
DO $$ BEGIN
  CREATE TYPE "process_status" AS ENUM ('draft', 'active', 'under_review', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "document_entity_type" ADD VALUE IF NOT EXISTS 'process';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processes" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" varchar(40) NOT NULL,
  "name" varchar(180) NOT NULL,
  "category" varchar(120) NOT NULL,
  "version" varchar(32) DEFAULT '1.0' NOT NULL,
  "status" "process_status" DEFAULT 'draft' NOT NULL,
  "ownerUserId" integer,
  "regionalId" integer,
  "objective" text,
  "scope" text,
  "description" text NOT NULL,
  "inputs" text,
  "outputs" text,
  "controls" text,
  "exceptions" text,
  "sla" text,
  "relatedModules" text,
  "kpis" text,
  "effectiveFrom" date,
  "reviewDate" date,
  "createdByUserId" integer,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "processes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "processes" ADD CONSTRAINT "processes_ownerUserId_users_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "processes" ADD CONSTRAINT "processes_regionalId_regionals_id_fk" FOREIGN KEY ("regionalId") REFERENCES "regionals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "processes" ADD CONSTRAINT "processes_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
