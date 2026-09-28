# Batch 1 — Remove AgriSpark (crop-price, record-keeper, LINE farm routing)

Issue #1 · Branch `compaction/01-agrispark` · Risk: **Medium** (LINE text path)

## Why
AgriSpark is over. More importantly, **every LINE text message currently runs an
agriculture intent classifier first** (`resolveLineAgricultureIntent`, default mode
`ai_only` = an extra LLM call per message). Removing it cuts cost and latency for
shop owners. Farm knowledge, if ever needed again, goes in a SKILL.md.

## Delete (whole files/folders)

```
features/crop-price/
features/record-keeper/
app/api/tools/crop-price/
features/line-oa/webhook/events/farm-records.ts
features/line-oa/webhook/events/intent-router.ts
features/line-oa/webhook/events/intent-router.test.ts
features/line-oa/flex/seeds/agrispark-templates.ts
app/api/admin/flex-templates/seed-agrispark/
features/response-format/templates/agriculture.ts
features/rich-messages/templates/agriculture.ts
features/task-flows/templates/agriculture.ts
docs/contest/                       (if it only holds AgriSpark material — check first)
```

## Edit

### Tool registry
- `features/tools/registry/client.ts` — remove `recordKeeperManifest`, `cropPriceManifest` imports and entries.
- `features/tools/registry/server.ts` — remove `recordKeeperManifest`, `createRecordKeeperAgentTools`, `cropPriceManifest`, `createCropPriceAgentTools` imports and entries.
- `features/tools/registry/page-loaders.ts` — remove the `crop-price` page loader.

### LINE text path — `features/line-oa/webhook/events/text-replies.ts`
- Remove imports: `handleFarmRecordMessage`, `readPendingFarmRecordDraft` (`./farm-records`), `runSummarizeRecords`, everything from `./intent-router`.
- In the main text handler (around line 520 onward) delete the whole agriculture block:
  `hasPendingFarmRecordDraft` → `resolveLineAgricultureIntent(...)` → the `weather_risk`,
  `farm_log_summary`, and `farm_log_create / confirm_pending / edit_pending / cancel_pending`
  branches. Control must fall straight through to the next block (case-workspace draft
  handling — leave that for batch 7).
- Delete helpers only used by those branches: `formatFarmSummaryText`, the Thai crop
  weather-advice helper (~line 196 `const crop = userText.match(...)`), `formatThaiWeatherRiskText`
  if only used here, and any `askLocationText` / `extractWeatherLocation` usage.
- Remove `intentRouterMode` from `HandleTextMessageInput`.
- **Rename** `latestPendingFarmRecordDraft` → `latestAssistantMetadata` in the input type and
  all uses. It is still needed: `readPendingCaseWorkspaceDraft(input.latestPendingFarmRecordDraft)`
  reads case drafts from the same metadata (batch 7 removes that too).

### LINE message entry — `features/line-oa/webhook/events/message.ts`
- Lines ~132, 216, 276: rename `latestPendingFarmRecordDraft` → `latestAssistantMetadata`.
- Lines ~51, 220, 280: stop passing `intentRouterMode`; remove it from the input type.

### LINE postback — `features/line-oa/webhook/events/postback.ts`
- Remove `runLogActivity` import and `readPendingFarmRecordDraft` import.
- Delete the farm-record-draft confirmation branch (~lines 100–160: finds
  `pendingFarmRecordDraft` in `chatMessage.metadata` and calls `runLogActivity`).
  Keep approval (batch 5) and case-workspace (batch 7) branches for now.

### LINE media — `features/line-oa/webhook/events/media-handlers.ts`
- ~line 319: remove the `skillHints.some(... /farm|crop|agri|pest|disease/ ...)` special case
  and the crop-specific instruction lines (~325). Keep the generic `domain_image` path
  with the generic observation instructions (~336).
- ~line 263: make the classifier prompt example generic (drop "plant/crop photos").

### LINE channel setting UI
- `intentRouterMode` on `lineOaChannel` is now unused. Remove it from any channel settings
  form / API zod schema under `features/line-oa/` and `app/api/line-oa/` (grep `intentRouterMode`).
  **Do not** drop the DB column (batch 10).

### Agent runtime — `features/agents/server/run-service.ts` + `run-helpers.ts`
- `run-service.ts`: remove `directFarmSummaryRequest` (line ~386) and the three
  farm-summary short-circuits that call `runSummarizeRecords` / `formatFarmRecordSummary`
  (~lines 393–425, ~456, ~559). Remove the imports (lines ~34–37).
- `run-helpers.ts`: delete `inferFarmRecordSummaryRequest`, `formatFarmRecordSummary`, and
  the plant-triage helper text around lines 186–260 if only used by these.
- `run-helpers.test.ts`, `run-tools.test.ts`: delete the farm/record_keeper test cases.

### Response pipeline
- `features/response-format/template-registry.ts` — remove `AGRICULTURE_RESPONSE_TEMPLATES`.
- `features/response-format/server/select.ts` — remove all `agriculture.*` template keys
  (lines ~195, 320–436). Where a branch chooses between `agriculture.X` and `common.Y`,
  keep `common.Y` unconditionally. Delete branches that only exist for farm/weather.
- `features/response-format/server/line-render.ts` — remove agriculture render cases.
- `features/rich-messages/registry.ts` — remove `AGRICULTURE_RICH_MESSAGE_TEMPLATES`.
- `features/rich-messages/schema.ts` — remove the six `agriculture*RichMessageSchema`s and types.
- `features/rich-messages/sample-data.ts` — remove agriculture samples.
- `features/task-flows/registry.ts` — `BUILTIN_TASK_FLOW_TEMPLATES` currently comes **only**
  from `templates/agriculture.ts`. Replace with `const BUILTIN_TASK_FLOW_TEMPLATES = [] as const`
  (typed to the template type) and keep the engine. Note in the PR that task-flows now has
  no built-in templates (follow-up candidate for removal).
- `features/line-oa/flex/linking.ts` + `linking.test.ts` — remove `agrispark-*` mappings.
- Update/delete affected tests: `features/response-format/service.test.ts`,
  `template-registry.test.ts`, `features/chat/audit/audit.test.ts`,
  `features/chat/server/finalization.test.ts` (the `crop_name` fixture).

### Admin & UI stragglers
- `app/admin/flex-templates/page.tsx` — remove the "Import AgriSpark Templates" button,
  its mutation, and the empty-state text that mentions it.
- `features/chat/components/empty-state/task-starter-data.ts` — remove farm starters.
- `features/agents/components/agent-tools-section.tsx`, `features/skills/server/parser.ts`,
  `app/landing/page.tsx` — remove agriculture/weather-*farm* references only if they point
  at removed tools. Leave generic marketing copy alone.

### Keep
- `lib/tools/weather.ts` (generic weather tool) — keep; only the LINE farm-risk direct path goes.
- `features/domain-profiles` — untouched here (batch 8). `farm-records.ts` imported its
  types; that import disappears with the file.

## Docs
- Delete AgriSpark sections from `CLAUDE.md` if any; delete `docs/contest/` if AgriSpark-only.

## Verify (in addition to README definition of done)
- `grep -rniE "agrispark|record-keeper|crop-price|farm_log|FarmRecord|resolveLineAgricultureIntent" app features lib` → no hits (tests included).
- Unit tests for LINE webhook still pass.
