CREATE TABLE "line_broadcast" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"name" text NOT NULL,
	"target_type" text DEFAULT 'all' NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"message_text" text,
	"message_payload" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"recipient_count" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "line_broadcast" ADD CONSTRAINT "line_broadcast_channel_id_line_oa_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."line_oa_channel"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "line_broadcast_channelId_idx" ON "line_broadcast" USING btree ("channel_id");
