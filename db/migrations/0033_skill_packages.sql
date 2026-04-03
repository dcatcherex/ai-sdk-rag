CREATE TABLE IF NOT EXISTS "skill_source" (
  "id" text PRIMARY KEY,
  "source_type" text NOT NULL,
  "canonical_url" text NOT NULL,
  "repo_owner" text,
  "repo_name" text,
  "repo_ref" text,
  "subdir_path" text,
  "default_entry_path" text NOT NULL DEFAULT 'SKILL.md',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "skill_source_canonicalUrl_idx" ON "skill_source" ("canonical_url");
CREATE INDEX IF NOT EXISTS "skill_source_sourceType_idx" ON "skill_source" ("source_type");

ALTER TABLE "agent_skill"
  ADD COLUMN IF NOT EXISTS "source_id" text REFERENCES "skill_source"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "skill_kind" text NOT NULL DEFAULT 'inline',
  ADD COLUMN IF NOT EXISTS "activation_mode" text NOT NULL DEFAULT 'rule',
  ADD COLUMN IF NOT EXISTS "entry_file_path" text NOT NULL DEFAULT 'SKILL.md',
  ADD COLUMN IF NOT EXISTS "installed_ref" text,
  ADD COLUMN IF NOT EXISTS "installed_commit_sha" text,
  ADD COLUMN IF NOT EXISTS "upstream_commit_sha" text,
  ADD COLUMN IF NOT EXISTS "sync_status" text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "pinned_to_installed_version" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "has_bundled_files" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "package_manifest" jsonb,
  ADD COLUMN IF NOT EXISTS "last_sync_checked_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp;

CREATE INDEX IF NOT EXISTS "agent_skill_sourceId_idx" ON "agent_skill" ("source_id");
CREATE INDEX IF NOT EXISTS "agent_skill_skillKind_idx" ON "agent_skill" ("skill_kind");
CREATE INDEX IF NOT EXISTS "agent_skill_syncStatus_idx" ON "agent_skill" ("sync_status");

CREATE TABLE IF NOT EXISTS "agent_skill_file" (
  "id" text PRIMARY KEY,
  "skill_id" text NOT NULL REFERENCES "agent_skill"("id") ON DELETE CASCADE,
  "relative_path" text NOT NULL,
  "file_kind" text NOT NULL,
  "media_type" text,
  "text_content" text,
  "size_bytes" integer,
  "checksum" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_skill_file_skillId_relativePath_idx" ON "agent_skill_file" ("skill_id", "relative_path");
CREATE INDEX IF NOT EXISTS "agent_skill_file_skillId_idx" ON "agent_skill_file" ("skill_id");
CREATE INDEX IF NOT EXISTS "agent_skill_file_kind_idx" ON "agent_skill_file" ("file_kind");
