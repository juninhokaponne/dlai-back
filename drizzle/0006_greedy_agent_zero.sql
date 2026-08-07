ALTER TYPE "public"."subscription_status" ADD VALUE 'incomplete_expired' BEFORE 'trialing';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'paused';--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "stripe_event_id" varchar(255);