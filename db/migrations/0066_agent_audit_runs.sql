CREATE TABLE IF NOT EXISTS "agent_audit_run" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"score_before" integer NOT NULL,
	"score_after" integer,
	"status_before" text NOT NULL,
	"status_after" text,
	"test_message" text DEFAULT '' NOT NULL,
	"findings" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"applied_change_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "agent_audit_run" ADD CONSTRAINT "agent_audit_run_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "agent_audit_run" ADD CONSTRAINT "agent_audit_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "agent_audit_run_agent_id_idx" ON "agent_audit_run" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_audit_run_user_id_idx" ON "agent_audit_run" USING btree ("user_id");
