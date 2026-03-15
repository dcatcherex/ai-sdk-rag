-- Content Marketing: social posts and connected accounts

CREATE TABLE "social_post" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "caption" text NOT NULL,
  "platforms" text[] NOT NULL,
  "platform_overrides" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "media" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "scheduled_at" timestamp,
  "published_at" timestamp,
  "brand_id" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "social_account" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "platform_account_id" text NOT NULL,
  "account_name" text NOT NULL,
  "account_type" text,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_expires_at" timestamp,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "social_post" ADD CONSTRAINT "social_post_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "social_account" ADD CONSTRAINT "social_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "social_post_userId_idx" ON "social_post" USING btree ("user_id");
CREATE INDEX "social_post_status_idx" ON "social_post" USING btree ("status");
CREATE INDEX "social_post_scheduledAt_idx" ON "social_post" USING btree ("scheduled_at");
CREATE INDEX "social_account_userId_idx" ON "social_account" USING btree ("user_id");
CREATE INDEX "social_account_platform_idx" ON "social_account" USING btree ("platform");
