-- ── Agent Teams: multi-agent orchestration ────────────────────────────────────
-- Migration: 0032_agent_teams
-- Tables: agent_team, agent_team_member, team_run, team_run_step

CREATE TABLE IF NOT EXISTS "agent_team" (
  "id"               text PRIMARY KEY,
  "user_id"          text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"             text NOT NULL,
  "description"      text,
  "routing_strategy" text NOT NULL DEFAULT 'sequential',
  "config"           jsonb NOT NULL DEFAULT '{}',
  "brand_id"         text REFERENCES "brand"("id") ON DELETE SET NULL,
  "is_public"        boolean NOT NULL DEFAULT false,
  "created_at"       timestamp DEFAULT now() NOT NULL,
  "updated_at"       timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_team_userId_idx" ON "agent_team" ("user_id");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_team_member" (
  "id"                   text PRIMARY KEY,
  "team_id"              text NOT NULL REFERENCES "agent_team"("id") ON DELETE CASCADE,
  "agent_id"             text NOT NULL REFERENCES "agent"("id") ON DELETE CASCADE,
  "role"                 text NOT NULL DEFAULT 'specialist',
  "display_role"         text,
  "position"             integer NOT NULL DEFAULT 0,
  "tags"                 text[] NOT NULL DEFAULT '{}',
  "handoff_instructions" text,
  "created_at"           timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_team_member_teamId_idx"  ON "agent_team_member" ("team_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_team_member_unique_idx" ON "agent_team_member" ("team_id", "agent_id");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "team_run" (
  "id"             text PRIMARY KEY,
  "team_id"        text NOT NULL REFERENCES "agent_team"("id") ON DELETE CASCADE,
  "user_id"        text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "thread_id"      text REFERENCES "chat_thread"("id") ON DELETE SET NULL,
  "status"         text NOT NULL DEFAULT 'running',
  "input_prompt"   text NOT NULL,
  "final_output"   text,
  "budget_credits" integer,
  "spent_credits"  integer NOT NULL DEFAULT 0,
  "error_message"  text,
  "created_at"     timestamp DEFAULT now() NOT NULL,
  "completed_at"   timestamp
);

CREATE INDEX IF NOT EXISTS "team_run_teamId_idx"   ON "team_run" ("team_id");
CREATE INDEX IF NOT EXISTS "team_run_userId_idx"   ON "team_run" ("user_id");
CREATE INDEX IF NOT EXISTS "team_run_threadId_idx" ON "team_run" ("thread_id");
CREATE INDEX IF NOT EXISTS "team_run_status_idx"   ON "team_run" ("status");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "team_run_step" (
  "id"                text PRIMARY KEY,
  "run_id"            text NOT NULL REFERENCES "team_run"("id") ON DELETE CASCADE,
  "member_id"         text REFERENCES "agent_team_member"("id") ON DELETE SET NULL,
  "agent_id"          text NOT NULL,
  "agent_name"        text NOT NULL,
  "role"              text NOT NULL,
  "step_index"        integer NOT NULL,
  "input_prompt"      text NOT NULL,
  "output"            text,
  "summary"           text,
  "artifact_type"     text NOT NULL DEFAULT 'other',
  "model_id"          text,
  "prompt_tokens"     integer,
  "completion_tokens" integer,
  "credit_cost"       integer NOT NULL DEFAULT 0,
  "status"            text NOT NULL DEFAULT 'running',
  "error_message"     text,
  "started_at"        timestamp DEFAULT now() NOT NULL,
  "completed_at"      timestamp
);

CREATE INDEX IF NOT EXISTS "team_run_step_runId_idx"    ON "team_run_step" ("run_id");
CREATE INDEX IF NOT EXISTS "team_run_step_memberId_idx" ON "team_run_step" ("member_id");
