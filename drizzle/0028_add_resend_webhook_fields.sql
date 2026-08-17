ALTER TABLE "email_send_events" ADD COLUMN "resend_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "email_send_events" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_send_events" ADD COLUMN "bounced_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_send_events" ADD COLUMN "bounce_type" varchar(50);--> statement-breakpoint
ALTER TABLE "email_send_events" ADD COLUMN "complained_at" timestamp;