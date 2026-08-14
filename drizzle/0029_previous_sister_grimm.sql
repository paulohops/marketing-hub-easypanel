ALTER TYPE "public"."operation_status" ADD VALUE 'paused' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "coverImageUrl" text;