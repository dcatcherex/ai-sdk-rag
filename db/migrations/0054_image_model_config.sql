CREATE TABLE "image_model_config" (
  "id" text PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "default_aspect_ratio" text,
  "default_quality" text,
  "default_resolution" text,
  "default_enable_pro" boolean DEFAULT false NOT NULL,
  "default_google_search" boolean DEFAULT false NOT NULL,
  "admin_notes" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "image_model_config_enabled_idx" ON "image_model_config" ("enabled");
