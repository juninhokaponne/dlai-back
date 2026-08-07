CREATE TYPE "public"."newsletter_status" AS ENUM('draft', 'generating', 'ready', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic" varchar(500) NOT NULL,
	"title" varchar(255),
	"content" text,
	"status" "newsletter_status" DEFAULT 'draft' NOT NULL,
	"generation_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;