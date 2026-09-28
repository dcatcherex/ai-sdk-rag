# Batch 10 — Drop tables for deleted modules + final docs sweep

Issue #10 · Branch `compaction/10-drop-tables` · Risk: **High** (irreversible on production data)

## Preconditions (all required)
- Batches 1–8 merged and deployed for **≥ 2 weeks** with no regressions. Batch 9 merged or
  explicitly skipped.
- Neon point-in-time recovery is enabled and its retention window covers today. Also
  take a manual branch/snapshot in Neon named `pre-compaction-drop` right before migrating.
- Owner approves the generated SQL on the PR **before** `drizzle-kit migrate` runs on production.

## Tables / columns to drop

| Schema file | Drop | From batch |
|-------------|------|-----------|
| `db/schema/tools.ts` | `activity_record` | 1 (record-keeper) — confirm with grep it is not used by anything else |
| `db/schema/line-oa.ts` | column `line_oa_channel.intent_router_mode` | 1 |
| `db/schema/integrations.ts` | whole file: `connected_account` | 2 + 5 |
| `db/schema/websites.ts` | whole file: `website`, `website_template`, `website_generation_log` | 3 |
| `db/schema/certificates.ts` | whole file: `certificate_template`, `certificate_job`, `recipient_group` | 4 |
| `db/schema/exams.ts` | whole file: `exam_draft`, `exam_question`, `exam_question_bank` | 4 |
| `db/schema/content.ts` | whole file: `content_piece` | 5 |
| `db/schema/analytics.ts` | whole file: `content_piece_metric`, `ab_variant`, `distribution_record` | 5 |
| `db/schema/planning.ts` | whole file: `campaign_brief`, `content_calendar_entry` | 5 |
| `db/schema/social.ts` | whole file: `social_post`, `social_account`, `trend_cache` | 5 |
| `db/schema/collaboration.ts` | whole file: `workspace_member`, `approval_request`, `content_comment`, `brand_guardrail` | 5 |
| `db/schema/tools.ts` | `brand_photo` | 5 |
| `db/schema/agent-teams.ts` | whole file: `agent_team`, `agent_team_member`, `team_run`, `team_run_step` | 6 |
| `db/schema/user-tools.ts` | whole file: `user_tool`, `user_tool_version`, `user_tool_share`, `user_tool_workspace_share`, `agent_user_tool_attachment`, `user_tool_connection` | 7 |
| `db/schema/prompts.ts` | whole file: `prompt_library` | 7 |
| `db/schema/tools.ts` | `workspace_ai_run` | 7 |
| `db/schema/domain-profiles.ts` | whole file: `domain_profile`, `domain_entity`, `domain_entity_relation` | 8 |

**Keep:** `stock_image`, `tool_run`, `tool_artifact`, `line_brand_draft` (used by
`features/line-oa/brand-draft/`), `brand*`, `brand_share`, `rich_message_template`,
everything in `line-oa.ts` except the one column.

Before dropping each table: `grep -rn "<tableExportName>" app features lib` must return
only the schema file and `db/schema.ts`. If anything else still uses it, **stop** and
list it in the PR — don't drop it.

## Steps
1. Remove table definitions (and relations) from the schema files above; delete files
   that become empty. Remove their re-exports from `db/schema.ts`.
2. Remove foreign keys / relations in **kept** tables that point at dropped tables
   (e.g. `agent` → user tools, `brand` → guardrails/workspace). Grep `references(() =>`.
3. `pnpm drizzle-kit generate` → open the generated SQL. Check by hand:
   - only `DROP TABLE` / `DROP COLUMN` / FK drops for the tables above;
   - no drops or alters on kept tables beyond removed FKs;
   - use `DROP TABLE ... CASCADE` only if drizzle emitted it; do not hand-add CASCADE.
4. Paste the SQL in the PR description. **Wait for owner approval.**
5. After approval: `pnpm drizzle-kit migrate` against dev, smoke test, then production.

## Final docs sweep (same PR)
- `CLAUDE.md`: rewrite **Directory Structure**, **Database Schema** tables, **Sidebar
  Navigation** (`SidebarNavItemId`), and **Adding a New Tool** examples to match the
  compacted app. Remove "Content Features", "Agent Teams" sections. Fix the auth line
  (Better Auth → Clerk; middleware is `proxy.ts`).
- `docs/`: delete any remaining docs for deleted modules (grep each module name).
- `docs/vaja-vision.md`: mark the compaction roadmap item done and update "Current Status".

## Verify
- `pnpm exec tsc --noEmit`, `pnpm build`, tests pass.
- Full smoke test (README) on the migrated dev DB, then on production after deploy.
