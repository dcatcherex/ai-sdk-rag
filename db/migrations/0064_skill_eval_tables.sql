-- Gap 9: skill eval / benchmark tooling
-- skill_eval_case: test messages with expected activation outcome
-- skill_eval_run: per-run precision/recall/F1 metrics

CREATE TABLE "skill_eval_case" (
  "id" text PRIMARY KEY NOT NULL,
  "skill_id" text NOT NULL REFERENCES "agent_skill"("id") ON DELETE cascade,
  "message" text NOT NULL,
  "should_activate" boolean NOT NULL,
  "label" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "skill_eval_case_skillId_idx" ON "skill_eval_case" ("skill_id");

CREATE TABLE "skill_eval_run" (
  "id" text PRIMARY KEY NOT NULL,
  "skill_id" text NOT NULL REFERENCES "agent_skill"("id") ON DELETE cascade,
  "ran_at" timestamp NOT NULL DEFAULT now(),
  "precision" real,
  "recall" real,
  "f1" real,
  "results" jsonb
);

CREATE INDEX "skill_eval_run_skillId_idx" ON "skill_eval_run" ("skill_id");
