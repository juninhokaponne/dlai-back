ALTER TABLE "newsletters" ADD COLUMN "recipient_count" integer;--> statement-breakpoint
ALTER TABLE "newsletters" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;