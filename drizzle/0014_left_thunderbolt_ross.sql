CREATE TYPE "public"."user_locale" AS ENUM('en', 'pt', 'es');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "user_locale" DEFAULT 'en' NOT NULL;