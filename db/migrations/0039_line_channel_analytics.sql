-- LINE channel daily stat tables for Priority 5: Metric logging

CREATE TABLE IF NOT EXISTS line_channel_daily_stat (
  id                TEXT PRIMARY KEY,
  channel_id        TEXT NOT NULL REFERENCES line_oa_channel(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,            -- YYYY-MM-DD
  message_count     INTEGER NOT NULL DEFAULT 0,
  unique_users      INTEGER NOT NULL DEFAULT 0,
  tool_call_count   INTEGER NOT NULL DEFAULT 0,
  images_sent       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT line_channel_daily_stat_channel_date_idx UNIQUE (channel_id, date)
);

CREATE INDEX IF NOT EXISTS line_channel_daily_stat_channelId_idx
  ON line_channel_daily_stat (channel_id);

CREATE TABLE IF NOT EXISTS line_channel_daily_user (
  id            TEXT PRIMARY KEY,
  channel_id    TEXT NOT NULL REFERENCES line_oa_channel(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  line_user_id  TEXT NOT NULL,
  CONSTRAINT line_channel_daily_user_uniq_idx UNIQUE (channel_id, date, line_user_id)
);

-- Metrics Reporter agent template

INSERT INTO agent (
  id,
  user_id,
  name,
  description,
  system_prompt,
  model_id,
  is_template,
  enabled_tools,
  starter_prompts,
  created_at,
  updated_at
) VALUES (
  'tpl_metrics_reporter',
  NULL,
  'Metrics Reporter',
  'Log content performance data and review analytics from LINE. Tell the agent your post stats and it will record them. Ask for channel activity summaries anytime.',
  'You are a marketing analytics assistant. Help the user track and understand their content performance and LINE channel activity.

When a user shares engagement numbers (views, likes, clicks, shares), use log_content_metric to record them. Always use list_recent_content first so the user can confirm which piece to log against.

Use get_content_performance to show aggregated stats for a content piece across platforms. Use get_channel_stats to show this LINE channel''s message volume and user activity trends.

Respond in plain text with bullet points (•). No markdown syntax. Keep summaries concise.',
  'google/gemini-2.5-flash-lite',
  TRUE,
  ARRAY['line_analytics'],
  ARRAY[
    'Show me our channel stats for the last 7 days',
    'Our Instagram post got 1200 impressions and 85 likes yesterday',
    'How is our latest blog post performing?'
  ],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name            = EXCLUDED.name,
  description     = EXCLUDED.description,
  system_prompt   = EXCLUDED.system_prompt,
  enabled_tools   = EXCLUDED.enabled_tools,
  starter_prompts = EXCLUDED.starter_prompts,
  updated_at      = NOW();
