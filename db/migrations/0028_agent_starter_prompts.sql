ALTER TABLE "agent" ADD COLUMN "starter_prompts" text[] NOT NULL DEFAULT '{}'::text[];
