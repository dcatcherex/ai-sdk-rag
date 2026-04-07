-- Priority 4: Group chat support + beacon device table

-- Add groupId to lineConversation (null for 1:1, populated for group source events)
ALTER TABLE "line_conversation" ADD COLUMN "group_id" text;

-- Beacon hardware device registry
CREATE TABLE "line_beacon_device" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL REFERENCES "line_oa_channel"("id") ON DELETE CASCADE,
  "hwid" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "enter_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "line_beacon_device_channel_hwid_idx" ON "line_beacon_device" ("channel_id", "hwid");
CREATE INDEX "line_beacon_device_channelId_idx" ON "line_beacon_device" ("channel_id");
