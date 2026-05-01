CREATE TABLE "agent_user_tool_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_tool_id" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tool" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text DEFAULT 'Wrench' NOT NULL,
	"category" text DEFAULT 'utilities' NOT NULL,
	"execution_type" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"read_only" boolean DEFAULT true NOT NULL,
	"requires_confirmation" boolean DEFAULT false NOT NULL,
	"supports_agent" boolean DEFAULT true NOT NULL,
	"supports_manual_run" boolean DEFAULT true NOT NULL,
	"latest_version" integer DEFAULT 0 NOT NULL,
	"active_version" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tool_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"key" text NOT NULL,
	"connection_type" text NOT NULL,
	"connected_account_id" text,
	"secret_ref" text,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tool_share" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"role" text DEFAULT 'runner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tool_version" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"version" integer NOT NULL,
	"input_schema_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_schema_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"change_summary" text,
	"is_draft" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_user_tool_attachment" ADD CONSTRAINT "agent_user_tool_attachment_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_user_tool_attachment" ADD CONSTRAINT "agent_user_tool_attachment_user_tool_id_user_tool_id_fk" FOREIGN KEY ("user_tool_id") REFERENCES "public"."user_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool" ADD CONSTRAINT "user_tool_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_connection" ADD CONSTRAINT "user_tool_connection_tool_id_user_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."user_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_connection" ADD CONSTRAINT "user_tool_conn_account_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_share" ADD CONSTRAINT "user_tool_share_tool_id_user_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."user_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_share" ADD CONSTRAINT "user_tool_share_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_version" ADD CONSTRAINT "user_tool_version_tool_id_user_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."user_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tool_version" ADD CONSTRAINT "user_tool_version_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_user_tool_attachment_unique_idx" ON "agent_user_tool_attachment" USING btree ("agent_id","user_tool_id");--> statement-breakpoint
CREATE INDEX "agent_user_tool_attachment_agentId_idx" ON "agent_user_tool_attachment" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_user_tool_attachment_userToolId_idx" ON "agent_user_tool_attachment" USING btree ("user_tool_id");--> statement-breakpoint
CREATE INDEX "user_tool_userId_idx" ON "user_tool" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_owner_slug_idx" ON "user_tool" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "user_tool_status_idx" ON "user_tool" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_connection_tool_key_idx" ON "user_tool_connection" USING btree ("tool_id","key");--> statement-breakpoint
CREATE INDEX "user_tool_connection_toolId_idx" ON "user_tool_connection" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_share_unique_idx" ON "user_tool_share" USING btree ("tool_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "user_tool_share_toolId_idx" ON "user_tool_share" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "user_tool_share_userId_idx" ON "user_tool_share" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tool_version_unique_idx" ON "user_tool_version" USING btree ("tool_id","version");--> statement-breakpoint
CREATE INDEX "user_tool_version_toolId_idx" ON "user_tool_version" USING btree ("tool_id");
