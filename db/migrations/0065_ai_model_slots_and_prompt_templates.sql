-- AI Model Slots (singleton, id = 1)
CREATE TABLE "ai_model_slots" (
  "id" integer PRIMARY KEY DEFAULT 1,
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

-- Prompt Templates
CREATE TABLE "ai_prompt_template" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "active_version_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Prompt Template Versions
CREATE TABLE "ai_prompt_template_version" (
  "id" text PRIMARY KEY,
  "template_id" text NOT NULL REFERENCES "ai_prompt_template"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "content" text NOT NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text
);

CREATE UNIQUE INDEX "ai_prompt_template_version_unique_idx"
  ON "ai_prompt_template_version"("template_id", "version");

-- Seed: base system prompt (version 1)
INSERT INTO "ai_prompt_template" ("id", "key", "name", "description")
VALUES (
  'pt_base_system',
  'system.default',
  'Base System Prompt',
  'Default assistant instructions injected into every chat session'
);

INSERT INTO "ai_prompt_template_version" ("id", "template_id", "version", "content", "note")
VALUES (
  'ptv_base_system_v1',
  'pt_base_system',
  1,
  E'You are a capable, proactive AI assistant with access to tools.\n- Be concise and clear. Use bullet points for multi-step answers.\n- Proactively use tools when they can improve accuracy or save the user effort — don''t wait to be asked.\n- Ask clarifying questions when requirements are ambiguous.\n- State assumptions explicitly. Do not fabricate facts.\n- If code is needed, include complete, runnable snippets with imports.\n- When unsure, explain trade-offs and propose next steps.',
  'Initial version seeded from lib/prompt.ts'
);

UPDATE "ai_prompt_template"
SET "active_version_id" = 'ptv_base_system_v1'
WHERE "id" = 'pt_base_system';
