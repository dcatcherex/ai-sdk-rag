CREATE TABLE "agent_audit_run" (
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
--> statement-breakpoint
CREATE TABLE "skill_eval_case" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"message" text NOT NULL,
	"should_activate" boolean NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_eval_run" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"ran_at" timestamp DEFAULT now() NOT NULL,
	"precision" real,
	"recall" real,
	"f1" real,
	"results" jsonb
);
--> statement-breakpoint
CREATE TABLE "domain_entity" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_entity_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"from_entity_id" text NOT NULL,
	"to_entity_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"line_user_id" text,
	"channel_id" text,
	"brand_id" text,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"locale" text DEFAULT 'th-TH' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_slots" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"chat_model" text,
	"background_model" text,
	"embedding_model" text,
	"image_model" text,
	"video_model" text,
	"audio_model" text,
	"tts_model" text,
	"transcription_model" text,
	"live_model" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_prompt_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_template_version" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "starter_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_run" ADD COLUMN "tool_kind" text DEFAULT 'built_in' NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_run" ADD COLUMN "tool_id" text;--> statement-breakpoint
ALTER TABLE "tool_run" ADD COLUMN "tool_version_id" text;--> statement-breakpoint
ALTER TABLE "tool_run" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "line_oa_channel" ADD COLUMN "intent_router_mode" text DEFAULT 'ai_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD COLUMN "discovery_mode" text DEFAULT 'hidden' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_skill_attachment" ADD COLUMN "discovery_mode_override" text;--> statement-breakpoint
ALTER TABLE "agent_audit_run" ADD CONSTRAINT "agent_audit_run_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_run" ADD CONSTRAINT "agent_audit_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_eval_case" ADD CONSTRAINT "skill_eval_case_skill_id_agent_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."agent_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_eval_run" ADD CONSTRAINT "skill_eval_run_skill_id_agent_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."agent_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_entity" ADD CONSTRAINT "domain_entity_profile_id_domain_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."domain_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_profile_id_domain_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."domain_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_from_entity_id_domain_entity_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."domain_entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_entity_relation" ADD CONSTRAINT "domain_entity_relation_to_entity_id_domain_entity_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."domain_entity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_profile" ADD CONSTRAINT "domain_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_profile" ADD CONSTRAINT "domain_profile_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_template_version" ADD CONSTRAINT "ai_prompt_template_version_template_id_ai_prompt_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ai_prompt_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_audit_run_agent_id_idx" ON "agent_audit_run" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_audit_run_user_id_idx" ON "agent_audit_run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_eval_case_skillId_idx" ON "skill_eval_case" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_eval_run_skillId_idx" ON "skill_eval_run" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "domain_entity_profileId_idx" ON "domain_entity" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "domain_entity_profileId_entityType_idx" ON "domain_entity" USING btree ("profile_id","entity_type");--> statement-breakpoint
CREATE INDEX "domain_entity_status_idx" ON "domain_entity" USING btree ("status");--> statement-breakpoint
CREATE INDEX "domain_entity_relation_profileId_idx" ON "domain_entity_relation" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "domain_entity_relation_fromEntityId_idx" ON "domain_entity_relation" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX "domain_entity_relation_toEntityId_idx" ON "domain_entity_relation" USING btree ("to_entity_id");--> statement-breakpoint
CREATE INDEX "domain_entity_relation_relationType_idx" ON "domain_entity_relation" USING btree ("relation_type");--> statement-breakpoint
CREATE INDEX "domain_profile_userId_idx" ON "domain_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "domain_profile_lineUserId_channelId_idx" ON "domain_profile" USING btree ("line_user_id","channel_id");--> statement-breakpoint
CREATE INDEX "domain_profile_brandId_idx" ON "domain_profile" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "domain_profile_domain_idx" ON "domain_profile" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "domain_profile_status_idx" ON "domain_profile" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_template_version_unique_idx" ON "ai_prompt_template_version" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "tool_run_toolKind_idx" ON "tool_run" USING btree ("tool_kind");--> statement-breakpoint
CREATE INDEX "tool_run_toolId_idx" ON "tool_run" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_run_agentId_idx" ON "tool_run" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "starter_prompts";