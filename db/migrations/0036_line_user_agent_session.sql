-- Track active agent per LINE user per channel (linked and anonymous users)
CREATE TABLE "line_user_agent_session" (
  "id" text PRIMARY KEY,
  "channel_id" text NOT NULL REFERENCES "line_oa_channel"("id") ON DELETE CASCADE,
  "line_user_id" text NOT NULL,
  "active_agent_id" text REFERENCES "agent"("id") ON DELETE SET NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "line_user_agent_session_channel_user_idx"
  ON "line_user_agent_session"("channel_id", "line_user_id");

CREATE INDEX "line_user_agent_session_channelId_idx"
  ON "line_user_agent_session"("channel_id");
