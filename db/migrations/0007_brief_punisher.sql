CREATE TABLE "custom_persona" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_customization" (
	"user_id" text NOT NULL,
	"persona_key" text NOT NULL,
	"extra_instructions" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "document_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "persona_detection_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_persona" ADD CONSTRAINT "custom_persona_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_customization" ADD CONSTRAINT "persona_customization_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_persona_userId_idx" ON "custom_persona" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "persona_customization_userId_idx" ON "persona_customization" USING btree ("user_id");