UPDATE "agent"
SET "starter_tasks" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', 'migrated-starter-' || ord::text,
        'title', CASE
          WHEN char_length(prompt) <= 52 THEN prompt
          ELSE substr(prompt, 1, 49) || '...'
        END,
        'description', 'Start here, then customize the details for your exact use case.',
        'prompt', prompt,
        'icon', 'sparkles',
        'priority', 'primary'
      )
      ORDER BY ord
    )
    FROM unnest("starter_prompts"[1:4]) WITH ORDINALITY AS starter(prompt, ord)
  ),
  '[]'::jsonb
)
WHERE jsonb_array_length(COALESCE("starter_tasks", '[]'::jsonb)) = 0
  AND cardinality("starter_prompts") > 0;--> statement-breakpoint

ALTER TABLE "agent" DROP COLUMN "starter_prompts";
