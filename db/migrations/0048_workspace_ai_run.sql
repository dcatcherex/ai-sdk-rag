CREATE TABLE "workspace_ai_run" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "route" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "model_id" text,
  "input_json" jsonb NOT NULL,
  "output_json" jsonb,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "workspace_ai_run" ADD CONSTRAINT "workspace_ai_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "workspace_ai_run_userId_idx" ON "workspace_ai_run" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "workspace_ai_run_kind_idx" ON "workspace_ai_run" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "workspace_ai_run_entityType_idx" ON "workspace_ai_run" USING btree ("entity_type");
--> statement-breakpoint
CREATE INDEX "workspace_ai_run_entityId_idx" ON "workspace_ai_run" USING btree ("entity_id");
