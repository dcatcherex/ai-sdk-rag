# Batch 5 — Remove the content suite (keep a slim `brands`)

Issue #5 · Branch `compaction/05-content-suite` · Risk: **Medium** (brand access, memory, LINE tools)

## Why
For a shop owner, "promotion" = a promotion **skill** + image generation + LINE broadcast.
Calendar, distribution, approvals, A/B metrics, repurposing, long-form, social
publishing, and brand workspaces are not used (1 `content_calendar_entry`, 1 `social_post`,
0 approvals in the DB).

## Decisions already made
- **Brand access becomes owner + `brand_share` only.** The `workspace_member` role system
  (collaboration) is removed. `brand_share` (in `db/schema/brands.ts`) stays.
- **`brands` stays** (brand voice, logo, ICP, assets are used in prompts: 16 core imports).
  Only the guardrails editor and workspace-member UI are removed from it.
- **LINE broadcast stays** (it's in `features/line-oa/broadcast/`, not `distribution`).
- **LINE channel stats tool stays** (`get_channel_stats` in `features/line-oa/metrics-tools.ts`).
- `brand_photo` has 57 rows but only `features/brand-photos` reads it — founder test data;
  delete the module. `stock_image` (67 rows) belongs to `features/image/stock-service.ts` — **keep**.

## Delete

```
features/content-marketing/
features/content-calendar/
features/content-hub/
features/distribution/
features/repurposing/
features/long-form/
features/collaboration/
features/brand-guardrails/
features/brand-photos/
features/analytics/                          (content metrics / A/B — NOT features/line-oa/analytics.ts)
features/line-oa/notifications/approval.ts
app/(main)/content/
app/(main)/content-calendar/
app/api/content-pieces/
app/api/content-calendar/
app/api/campaign-briefs/
app/api/distribution/
app/api/approvals/
app/api/comments/
app/api/brand-guardrails/
app/api/brand-photos/
app/api/repurpose/
app/api/analytics/                           (analyze, metrics, variants)
app/api/social/                              (accounts, callback, connect)
app/api/cron/publish-scheduled/
app/api/cron/refresh-trends/
app/api/tools/content-marketing/
app/api/tools/brand-profile/                 (check first: delete only if it serves content-marketing; keep if brands UI calls it)
app/api/brands/[id]/guardrails/
app/api/brands/[id]/workspace/
docs/content-marketing.md
docs/line-content-marketing-dev-guide.md
docs/line-content-marketing-user-flow.md
```

## Edit

### Tool registry
- `client.ts`, `server.ts` (16 refs), `page-loaders.ts` — remove every manifest / agent tool /
  page loader from the deleted modules (content-marketing, content-calendar, distribution,
  repurposing, long-form, collaboration, brand-guardrails, brand-photos, analytics).

### Brand access — `features/agents/server/brand-resolution.ts`
- In `loadDefaultDependencies()` (~line 55) drop the `@/features/collaboration/service`
  import. `hasWorkspaceAccess` becomes: owner → true; else check `brandShare`
  (`brandShare.brandId = brandId AND brandShare.sharedWithUserId = userId`). Put that query
  in `features/brands/service.ts` as `hasBrandShare(userId, brandId)` and call it.
- Keep the function name `hasWorkspaceAccess` to limit churn (or rename to `hasBrandAccess`
  and update its test — your call, note it in the PR).

### Brand memory — `features/memory/server/brand-memory.ts` + `features/memory/types.ts`
- Remove the `workspaceMember` query and the `WorkspaceMemberRole` import.
- New rule: `canRead = isOwner || shareRow.length > 0`, `canWrite = isOwner`.
- Remove `workspaceRole` from the access type in `features/memory/types.ts` (line ~47) and
  from `features/memory/components/brand-memory-tab.tsx` (line ~78).

### Response workflow capabilities — `features/privacy-governance/access-control.ts`
- Remove the `workspaceMember` query (~lines 80–100) and the `workspaceRole` input.
- `deriveResponseWorkflowCapabilities`: keep the owner branch and the brand-share branch;
  delete the `switch (input.workspaceRole)` block.
- Update `access-control.test.ts` — delete the reviewer/writer cases, keep owner/share cases.
- Caller `features/agents/server/run-service.ts` (`listResponseWorkflowCapabilities`) needs no change.

### Brands UI — `features/brands/components/brand-editor-sheet.tsx`
- Remove `GuardrailEditor` import (line 22) and its tab/section.
- Remove any workspace-members tab that calls `/api/brands/[id]/workspace`.

### LINE
- `features/line-oa/webhook/tools.ts` — remove imports (lines 18–19) and the
  `content_marketing` / `content_planning` blocks (~lines 222–228). Keep `line_analytics`.
- `features/line-oa/metrics-tools.ts` — remove `list_recent_content`, `log_content_metric`,
  `get_content_performance` tools and the `@/features/analytics/service` import. Keep
  `get_channel_stats`.
- `features/line-oa/webhook/events/postback.ts` — remove `resolveApprovalRequest` import
  (line 6) and the approval postback block (~lines 365–400).

### user-tools workflow executor (module deleted in batch 7)
- `features/user-tools/server/executors/workflow.ts` imports content-calendar and
  content-marketing. Remove those workflow step types (create post / schedule entry) so it
  compiles. Do not do more — batch 7 deletes the module.

### Cron
- `vercel.json` — remove the `/api/cron/refresh-trends` entry (leave `"crons": []` or remove
  the key if nothing else is in the file).

### Stragglers
- `features/workspace/catalog.ts` — remove Content / Content Calendar nav entries.
- `features/chat/components/sidebar/*`, `app/(main)/settings/page.tsx` — remove links/toggles
  for content hub, calendar, social accounts, approvals.
- `connectedAccount` (`db/schema/integrations.ts`) — its only remaining users were
  content-marketing/content-hub; now unused. Leave the schema (batch 10).
- `app/landing/page.tsx` — remove content-suite marketing cards.
- `CLAUDE.md` — delete "Content Features" section, `content*/distribution/collaboration/`
  lines from the directory tree, and content tables from the schema tables.

## Verify
- `grep -rnE "features/(content-marketing|content-calendar|content-hub|distribution|repurposing|long-form|collaboration|brand-guardrails|brand-photos|analytics)/|workspaceMember|WorkspaceMemberRole|/api/(social|approvals|comments|content-pieces|campaign-briefs)" app features lib components` → no hits.
- Agents page: an agent with a brand attached still resolves the brand in chat.
- Brand memory tab still loads for the owner.
