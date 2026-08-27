ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_created';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_updated';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_status_changed';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'entity_deleted';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'task_assigned';--> statement-breakpoint
ALTER TYPE "notification_category" ADD VALUE IF NOT EXISTS 'task_due';--> statement-breakpoint
ALTER TYPE "task_source" ADD VALUE IF NOT EXISTS 'context';--> statement-breakpoint
