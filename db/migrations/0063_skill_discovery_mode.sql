-- Gap 3: decouple discovery mode from activation mode
-- discovery_mode = 'catalog' → skill appears in available_skills catalog (LLM can auto-discover)
-- discovery_mode = 'hidden'  → skill is rule-only, not listed in catalog

ALTER TABLE "agent_skill"
  ADD COLUMN "discovery_mode" text NOT NULL DEFAULT 'hidden';

-- Backfill: skills that were 'model' activation are catalog-discoverable
UPDATE "agent_skill" SET "discovery_mode" = 'catalog' WHERE "activation_mode" = 'model';
-- Skills that were 'rule' stay 'hidden' (already the default)

-- Also add override column to attachment table for per-agent overrides
ALTER TABLE "agent_skill_attachment"
  ADD COLUMN "discovery_mode_override" text;
