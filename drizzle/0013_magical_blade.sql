CREATE TYPE "public"."newsletter_view_mode" AS ENUM('list', 'grid');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "newsletter_view_mode" "newsletter_view_mode" DEFAULT 'list' NOT NULL;