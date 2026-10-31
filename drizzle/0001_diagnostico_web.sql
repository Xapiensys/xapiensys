ALTER TABLE "leads" ALTER COLUMN "source" SET DATA TYPE varchar(16);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "site_url" text;