CREATE TYPE "public"."automation_run_contact_status" AS ENUM('pending', 'waiting', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'automation_paused_insufficient_credits';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'automation_run_failed';--> statement-breakpoint
CREATE TABLE "automation_run_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"current_node_id" varchar(255) NOT NULL,
	"status" "automation_run_contact_status" DEFAULT 'pending' NOT NULL,
	"wait_until" timestamp,
	"last_send_event_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"newsletter_id" uuid,
	"status" "automation_run_status" DEFAULT 'running' NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_send_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_contact_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"newsletter_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"clicked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "next_run_at" timestamp;--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "last_run_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64) DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_run_contacts" ADD CONSTRAINT "automation_run_contacts_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_contacts" ADD CONSTRAINT "automation_run_contacts_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_contacts" ADD CONSTRAINT "automation_run_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_send_events" ADD CONSTRAINT "automation_send_events_run_contact_id_automation_run_contacts_id_fk" FOREIGN KEY ("run_contact_id") REFERENCES "public"."automation_run_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_send_events" ADD CONSTRAINT "automation_send_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_send_events" ADD CONSTRAINT "automation_send_events_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;