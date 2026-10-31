ALTER TABLE "leads" RENAME TO "contacts";--> statement-breakpoint
ALTER TABLE "contacts" DROP CONSTRAINT "leads_code_unique";--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_lead_id_leads_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_lead_id_leads_id_fk";
--> statement-breakpoint
DROP INDEX "leads_created_at_idx";--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_lead_id_contacts_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_contacts_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_code_unique" UNIQUE("code");