CREATE TABLE "connected_account" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_account_id" text NOT NULL,
  "email" text,
  "display_name" text,
  "avatar_url" text,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_expires_at" timestamp,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connected_account"
  ADD CONSTRAINT "connected_account_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "connected_account_userId_idx" ON "connected_account" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "connected_account_provider_idx" ON "connected_account" USING btree ("provider");
--> statement-breakpoint
CREATE UNIQUE INDEX "connected_account_user_provider_providerAccount_idx"
  ON "connected_account" USING btree ("user_id", "provider", "provider_account_id");
