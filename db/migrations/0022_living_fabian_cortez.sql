-- LINE OA Integration tables
CREATE TABLE "line_oa_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text,
	"name" text NOT NULL,
	"line_channel_id" text NOT NULL,
	"channel_secret" text NOT NULL,
	"channel_access_token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "line_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "line_oa_channel" ADD CONSTRAINT "line_oa_channel_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "line_oa_channel" ADD CONSTRAINT "line_oa_channel_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "line_conversation" ADD CONSTRAINT "line_conversation_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "line_conversation" ADD CONSTRAINT "line_conversation_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "line_oa_channel_userId_idx" ON "line_oa_channel" USING btree ("user_id");
CREATE INDEX "line_oa_channel_lineChannelId_idx" ON "line_oa_channel" USING btree ("line_channel_id");
CREATE UNIQUE INDEX "line_conversation_channel_user_idx" ON "line_conversation" USING btree ("channel_id","line_user_id");
CREATE INDEX "line_conversation_channelId_idx" ON "line_conversation" USING btree ("channel_id");
CREATE INDEX "line_conversation_threadId_idx" ON "line_conversation" USING btree ("thread_id");
