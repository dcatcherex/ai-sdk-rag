CREATE TABLE "activity_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"context_type" text NOT NULL,
	"category" text,
	"entity" text,
	"date" date NOT NULL,
	"activity" text NOT NULL,
	"quantity" text,
	"cost" numeric(10, 2),
	"income" numeric(10, 2),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_record" ADD CONSTRAINT "activity_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "activity_record_userId_contextType_idx" ON "activity_record" USING btree ("user_id","context_type");--> statement-breakpoint
CREATE INDEX "activity_record_userId_date_idx" ON "activity_record" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "activity_record_entity_idx" ON "activity_record" USING btree ("entity");
