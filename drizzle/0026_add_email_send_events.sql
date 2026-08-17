CREATE TABLE "email_send_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"newsletter_id" uuid,
	"run_contact_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"clicked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "email_send_events" ADD CONSTRAINT "email_send_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_events" ADD CONSTRAINT "email_send_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_events" ADD CONSTRAINT "email_send_events_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_events" ADD CONSTRAINT "email_send_events_run_contact_id_automation_run_contacts_id_fk" FOREIGN KEY ("run_contact_id") REFERENCES "public"."automation_run_contacts"("id") ON DELETE cascade ON UPDATE no action;