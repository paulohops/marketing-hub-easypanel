CREATE TABLE "action_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"objective" text,
	"defaultActionTypeId" integer,
	"defaultPartnershipType" "partnership_type" DEFAULT 'paid' NOT NULL,
	"defaultDurationHours" integer,
	"active" boolean DEFAULT true NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "actionTemplateId" integer;--> statement-breakpoint
ALTER TABLE "action_templates" ADD CONSTRAINT "action_templates_defaultActionTypeId_action_types_id_fk" FOREIGN KEY ("defaultActionTypeId") REFERENCES "public"."action_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_templates" ADD CONSTRAINT "action_templates_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_actionTemplateId_action_templates_id_fk" FOREIGN KEY ("actionTemplateId") REFERENCES "public"."action_templates"("id") ON DELETE set null ON UPDATE no action;