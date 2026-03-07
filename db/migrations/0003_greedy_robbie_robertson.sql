CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"system_prompt" text NOT NULL,
	"model_id" text,
	"enabled_tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"fact" text NOT NULL,
	"source_thread_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_model_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled_model_ids" text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_model_score" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"persona" text NOT NULL,
	"thumbs_up" integer DEFAULT 0 NOT NULL,
	"thumbs_down" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"memory_enabled" boolean DEFAULT true NOT NULL,
	"prompt_enhancement_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "parent_asset_id" text;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "root_asset_id" text;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "edit_prompt" text;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_preference" ADD CONSTRAINT "user_model_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_model_score" ADD CONSTRAINT "user_model_score_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_userId_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memory_userId_idx" ON "user_memory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_model_score_userId_idx" ON "user_model_score" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_model_score_combo_idx" ON "user_model_score" USING btree ("user_id","model_id","persona");--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_parent_fk" FOREIGN KEY ("parent_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_asset_parent_idx" ON "media_asset" USING btree ("parent_asset_id");--> statement-breakpoint
CREATE INDEX "media_asset_root_idx" ON "media_asset" USING btree ("root_asset_id");