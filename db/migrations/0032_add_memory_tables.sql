CREATE TABLE "memory_record" (
	"id" text PRIMARY KEY NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"memory_type" text DEFAULT 'shared_fact' NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"category" text,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_thread_id" text,
	"created_by_user_id" text NOT NULL,
	"approved_by_user_id" text,
	"rejected_by_user_id" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"archived_at" timestamp,
	"last_referenced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "thread_working_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"brand_id" text,
	"summary" text DEFAULT '' NOT NULL,
	"current_objective" text,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"important_context" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recent_artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_message_id" text,
	"refresh_status" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"refreshed_at" timestamp,
	"cleared_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "memory_record" ADD CONSTRAINT "memory_record_source_thread_id_chat_thread_id_fk" FOREIGN KEY ("source_thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_record" ADD CONSTRAINT "memory_record_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_record" ADD CONSTRAINT "memory_record_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_record" ADD CONSTRAINT "memory_record_rejected_by_user_id_user_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "thread_working_memory" ADD CONSTRAINT "thread_working_memory_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "thread_working_memory" ADD CONSTRAINT "thread_working_memory_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "thread_working_memory" ADD CONSTRAINT "thread_working_memory_last_message_id_chat_message_id_fk" FOREIGN KEY ("last_message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "memory_record_scope_idx" ON "memory_record" USING btree ("scope_type","scope_id");
--> statement-breakpoint
CREATE INDEX "memory_record_scope_status_idx" ON "memory_record" USING btree ("scope_type","scope_id","status");
--> statement-breakpoint
CREATE INDEX "memory_record_type_idx" ON "memory_record" USING btree ("memory_type");
--> statement-breakpoint
CREATE INDEX "memory_record_created_by_idx" ON "memory_record" USING btree ("created_by_user_id");
--> statement-breakpoint
CREATE INDEX "memory_record_source_thread_idx" ON "memory_record" USING btree ("source_thread_id");
--> statement-breakpoint
CREATE INDEX "memory_record_updated_at_idx" ON "memory_record" USING btree ("updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "thread_working_memory_thread_id_idx" ON "thread_working_memory" USING btree ("thread_id");
--> statement-breakpoint
CREATE INDEX "thread_working_memory_brand_id_idx" ON "thread_working_memory" USING btree ("brand_id");
--> statement-breakpoint
CREATE INDEX "thread_working_memory_refreshed_at_idx" ON "thread_working_memory" USING btree ("refreshed_at");
