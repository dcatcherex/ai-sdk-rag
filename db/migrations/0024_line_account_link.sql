CREATE TABLE "line_account_link_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "line_account_link_token_token_unique" UNIQUE("token")
);

CREATE TABLE "line_account_link" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"picture_url" text,
	"linked_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "line_account_link_token" ADD CONSTRAINT "line_account_link_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "line_account_link_token" ADD CONSTRAINT "line_account_link_token_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "line_account_link" ADD CONSTRAINT "line_account_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "line_account_link" ADD CONSTRAINT "line_account_link_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "line_account_link_token_userId_idx" ON "line_account_link_token" USING btree ("user_id");
CREATE INDEX "line_account_link_token_channelId_idx" ON "line_account_link_token" USING btree ("channel_id");
CREATE UNIQUE INDEX "line_account_link_channel_line_user_idx" ON "line_account_link" USING btree ("channel_id","line_user_id");
CREATE INDEX "line_account_link_userId_idx" ON "line_account_link" USING btree ("user_id");
CREATE INDEX "line_account_link_channelId_idx" ON "line_account_link" USING btree ("channel_id");
