CREATE TABLE "chat_run" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "thread_id" text NOT NULL,
  "agent_id" text,
  "brand_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "route_kind" text DEFAULT 'text' NOT NULL,
  "requested_model_id" text,
  "resolved_model_id" text,
  "routing_mode" text,
  "routing_reason" text,
  "use_web_search" boolean DEFAULT false NOT NULL,
  "used_tools" boolean DEFAULT false NOT NULL,
  "tool_call_count" integer DEFAULT 0 NOT NULL,
  "input_json" jsonb NOT NULL,
  "output_json" jsonb,
  "error_message" text,
  "credit_cost" integer,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "total_tokens" integer,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_run" ADD CONSTRAINT "chat_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_run" ADD CONSTRAINT "chat_run_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_run" ADD CONSTRAINT "chat_run_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_run_userId_idx" ON "chat_run" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "chat_run_threadId_idx" ON "chat_run" USING btree ("thread_id");
--> statement-breakpoint
CREATE INDEX "chat_run_agentId_idx" ON "chat_run" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "chat_run_status_idx" ON "chat_run" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "chat_run_resolvedModelId_idx" ON "chat_run" USING btree ("resolved_model_id");
--> statement-breakpoint
CREATE INDEX "chat_run_createdAt_idx" ON "chat_run" USING btree ("created_at");
