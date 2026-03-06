CREATE TABLE IF NOT EXISTS "user_model_score" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "model_id" text NOT NULL,
  "persona" text NOT NULL,
  "thumbs_up" integer NOT NULL DEFAULT 0,
  "thumbs_down" integer NOT NULL DEFAULT 0,
  "score" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_model_score_userId_idx" ON "user_model_score" ("user_id");
CREATE INDEX IF NOT EXISTS "user_model_score_combo_idx" ON "user_model_score" ("user_id", "model_id", "persona");
