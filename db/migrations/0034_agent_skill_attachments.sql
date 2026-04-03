CREATE TABLE IF NOT EXISTS "agent_skill_attachment" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "skill_id" text NOT NULL REFERENCES "agent_skill"("id") ON DELETE CASCADE,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "activation_mode_override" text,
  "trigger_type_override" text,
  "trigger_override" text,
  "priority" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_skill_attachment_agentId_skillId_idx" ON "agent_skill_attachment" ("agent_id", "skill_id");
CREATE INDEX IF NOT EXISTS "agent_skill_attachment_agentId_idx" ON "agent_skill_attachment" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_skill_attachment_skillId_idx" ON "agent_skill_attachment" ("skill_id");

INSERT INTO "agent_skill_attachment" (
  "id",
  "agent_id",
  "skill_id",
  "is_enabled",
  "priority",
  "created_at",
  "updated_at"
)
SELECT
  md5("agent"."id" || ':' || "skill_id" || ':' || "ordinality"::text),
  "agent"."id",
  "skill_id",
  true,
  "ordinality" - 1,
  now(),
  now()
FROM "agent"
CROSS JOIN LATERAL unnest("agent"."skill_ids") WITH ORDINALITY AS legacy_skills("skill_id", "ordinality")
ON CONFLICT ("agent_id", "skill_id") DO NOTHING;
