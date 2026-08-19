-- Debriefing do ponto audiovisual.
-- Mantém a aplicação segura em bancos que já possuem as migrações financeiras e de catálogo anteriores.
ALTER TABLE "media_points" ADD COLUMN IF NOT EXISTS "debriefRating" integer;
--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN IF NOT EXISTS "debriefNotes" text;
--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN IF NOT EXISTS "debriefResult" text;
--> statement-breakpoint
ALTER TABLE "media_points" ADD COLUMN IF NOT EXISTS "debriefAt" timestamp with time zone;
