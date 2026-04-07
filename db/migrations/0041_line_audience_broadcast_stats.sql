-- Priority 2: Narrowcast audience tables + broadcast stats field

-- Add customAggregationUnit to lineBroadcast for LINE insight API
ALTER TABLE "line_broadcast" ADD COLUMN "custom_aggregation_unit" text;

-- Audience group table (uploaded to LINE for narrowcast targeting)
CREATE TABLE "line_audience" (
  "id" text PRIMARY KEY NOT NULL,
  "channel_id" text NOT NULL REFERENCES "line_oa_channel"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "line_audience_group_id" text,
  "audience_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'creating',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "line_audience_channelId_idx" ON "line_audience" ("channel_id");

-- Per-user membership in an audience group
CREATE TABLE "line_audience_user" (
  "id" text PRIMARY KEY NOT NULL,
  "audience_id" text NOT NULL REFERENCES "line_audience"("id") ON DELETE CASCADE,
  "line_user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "line_audience_user_audience_line_user_idx" ON "line_audience_user" ("audience_id", "line_user_id");
