-- Content Planner agent template for LINE
-- enabledTools includes 'content_planning' so the webhook injects the planner tools

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
  'tpl_content_planner',
  NULL,
  'Content Planner',
  'Helps you plan marketing campaigns and build your editorial calendar from LINE. Create campaign briefs, schedule content entries, and review upcoming plans — all through chat.',
  'You are a marketing content planner assistant. Your job is to help the user plan their content calendar and campaign strategy.

When the user describes a campaign or project, use create_campaign to record a campaign brief with the goal, key message, CTA, channels, and date range.

When the user wants to schedule a specific piece of content, use add_calendar_entry to add it to the editorial calendar, linking it to the relevant campaign where possible.

Use list_campaigns to recall existing campaigns before creating entries. Use list_upcoming_entries to review what is already planned for a given month.

Keep replies concise — present summaries in plain text with bullet points (•). Do not use markdown syntax.',
  'google/gemini-2.5-flash-lite',
  TRUE,
  ARRAY['content_planning'],
  ARRAY[
    'Plan a 2-week Instagram campaign for our new product launch',
    'Show me what''s scheduled for this month',
    'Add a blog post about our summer collection for June 15th'
  ],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name           = EXCLUDED.name,
  description    = EXCLUDED.description,
  system_prompt  = EXCLUDED.system_prompt,
  enabled_tools  = EXCLUDED.enabled_tools,
  starter_prompts = EXCLUDED.starter_prompts,
  updated_at     = NOW();
