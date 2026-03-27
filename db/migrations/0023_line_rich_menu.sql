CREATE TABLE "line_rich_menu" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL,
  "line_menu_id" text,
  "name" text NOT NULL,
  "chat_bar_text" text NOT NULL DEFAULT 'เมนู',
  "areas" jsonb NOT NULL DEFAULT '[]',
  "is_default" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'draft',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "line_user_menu" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL,
  "line_user_id" text NOT NULL,
  "line_menu_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "line_rich_menu"
  ADD CONSTRAINT "line_rich_menu_channel_id_fk"
  FOREIGN KEY ("channel_id") REFERENCES "line_oa_channel"("id") ON DELETE CASCADE;

ALTER TABLE "line_user_menu"
  ADD CONSTRAINT "line_user_menu_channel_id_fk"
  FOREIGN KEY ("channel_id") REFERENCES "line_oa_channel"("id") ON DELETE CASCADE;

CREATE INDEX "line_rich_menu_channelId_idx" ON "line_rich_menu" ("channel_id");
CREATE UNIQUE INDEX "line_user_menu_channel_user_idx" ON "line_user_menu" ("channel_id", "line_user_id");
