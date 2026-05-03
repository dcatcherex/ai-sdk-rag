# Platform Refactor Implementation Plan

> Audience: AI coders and developers improving chat, agent-run, routing, memory, and persistence architecture.
> Purpose: turn the current architecture review into staged, independently shippable refactors with clear seams, tests, and stop conditions.

---

## Core Rule

**Deepen existing modules before creating new top-level coordinators.**

The app already has a canonical agent-run seam: `prepareAgentRun()` in `features/agents/server/run-service.ts`. The chat route should stay an orchestrator, and `prepareAgentRun()` should stay the place where model, prompt, tools, skills, and credit cost are resolved.

Do not introduce a broad `ChatRequestCoordinator` that duplicates `prepareAgentRun()`. If a route feels too large, extract web-only preparation and finalization helpers around the existing seam.

---

## Architecture Vocabulary

Use these terms consistently in implementation notes and PR descriptions:

| Term | Meaning |
|------|---------|
| Module | Anything with an interface and implementation |
| Interface | Everything callers must know to use a module correctly |
| Implementation | The code inside the module |
| Depth | Leverage behind a small interface |
| Seam | A place where behavior can vary without editing callers |
| Adapter | A concrete implementation at a seam |
| Leverage | What callers get from a deeper module |
| Locality | What maintainers get when bugs and changes live in one place |

The deletion test applies to every extraction: if deleting the new module would merely move its complexity into callers, it is too shallow.

---

## Progress Update

- [x] Phase 1: routing intent detection extracted into `features/chat/server/routing-intent.ts`
- [x] `features/chat/server/routing.ts` now consumes `detectRoutingIntent()` and exposes `getModelUserScore()`
- [x] Focused tests added in `features/chat/server/routing.test.ts`
- [x] Phase 2: memory split into `features/memory/server/brand-memory.ts`, `working-memory.ts`, and `shared.ts`
- [x] Phase 3: chat finalization and persistence split into focused finalization, message persistence, token usage, and billing modules
- [x] Phase 4: internal `prepareAgentRun()` stages extracted into focused internal modules
- [x] Phase 5: web chat route trimming extracted web-only identity, active-agent, channel-context, image-context, and finalization helpers

Current stop point: all five planned phases are implemented. `app/api/chat/route.ts` is reduced to an HTTP orchestration module that still calls `prepareAgentRun()` exactly once.

---

## Refactor Order

1. Extract routing intent detection.
2. Split memory into brand memory and working memory.
3. Deepen chat finalization and persistence.
4. Deepen `prepareAgentRun()` behind internal stages.
5. Trim `app/api/chat/route.ts` with web-only helpers.

This order starts with low-risk, high-leverage modules and leaves the large route refactor until the underlying seams are stronger.

---

## Phase 1: Routing Intent

**Goal:** separate intent detection from model ranking.

**Files:**
- `features/chat/server/routing.ts`
- new `features/chat/server/routing-intent.ts`
- optional `features/chat/server/model-ranking.ts`

**Problem:** `getModelByIntent()` currently detects image, web, code, and reasoning intent while also ranking models. Callers cannot reuse intent detection without buying the whole model-selection algorithm.

**Implementation:**

Create `features/chat/server/routing-intent.ts`:

```typescript
export type RoutingIntent = {
  wantsImage: boolean;
  wantsWeb: boolean;
  wantsCode: boolean;
  wantsReasoning: boolean;
  wordCount: number;
};

export function detectRoutingIntent(input: {
  prompt: string | null;
  useWebSearch?: boolean;
}): RoutingIntent;
```

Then update `getModelByIntent()` to call `detectRoutingIntent()` and keep ranking in `routing.ts`.

If user-score logic remains duplicated, extract a small helper:

```typescript
export function getModelUserScore(modelId: string, userScores?: ModelScoreMap): number;
```

**Tests:**
- Empty prompt returns all intent flags false and `wordCount: 0`.
- Image prompts set only `wantsImage`.
- `useWebSearch: true` sets `wantsWeb` even if the prompt has no web keywords.
- Code prompts set `wantsCode`.
- Reasoning prompts set `wantsReasoning`.
- `getModelByIntent()` keeps existing routing behavior for representative prompts.

**Status:** Completed.

**Implemented:**
- Added `features/chat/server/routing-intent.ts` with `detectRoutingIntent()` and `RoutingIntent`.
- Updated `features/chat/server/routing.ts` to consume the new intent module.
- Extracted `getModelUserScore()` to remove duplicated user-score accumulation logic.
- Added focused tests in `features/chat/server/routing.test.ts` and included `features/chat/server/*.test.ts` in the standard `pnpm test` script.

**Acceptance Criteria:**
- `getModelByIntent()` still exports the same public interface.
- Intent regexes live in one module.
- No route imports `detectRoutingIntent()` unless it truly needs intent without model selection.

---

## Phase 2: Memory Split

**Goal:** separate brand memory CRUD from working memory prompt assembly.

**Files:**
- `features/memory/service.ts`
- new `features/memory/server/brand-memory.ts`
- new `features/memory/server/working-memory.ts`
- optional `features/memory/server/shared.ts`
- `lib/ai.ts` or a memory config module for the working-memory model constant

**Problem:** `features/memory/service.ts` mixes brand memory permissions, CRUD, approvals, archival, thread working memory, prompt block builders, and model-based refresh logic.

**Implementation:**

Move brand memory functions to `brand-memory.ts`:
- `getBrandMemoryPermissions`
- `listBrandMemory`
- `createBrandMemory`
- `updateBrandMemory`
- `approveBrandMemory`
- `rejectBrandMemory`
- `archiveBrandMemory`
- `deleteBrandMemory`
- `buildBrandMemoryPromptBlock`

Move working memory functions to `working-memory.ts`:
- `getThreadWorkingMemory`
- `buildThreadWorkingMemoryPromptBlock`
- `refreshThreadWorkingMemoryFromMessages`
- `refreshThreadWorkingMemory`
- `clearThreadWorkingMemory`

Keep `features/memory/service.ts` as a temporary re-export facade:

```typescript
export * from './server/brand-memory';
export * from './server/working-memory';
```

Move shared mappers or helpers into `features/memory/server/shared.ts` only if both modules use them.

**Tests:**
- `buildThreadWorkingMemoryPromptBlock()` formats existing memory without importing brand-memory mutations.
- `buildBrandMemoryPromptBlock()` filters approved relevant records.
- Refresh parsing handles invalid model JSON by returning empty working memory.

**Status:** Completed.

**Implemented:**
- Added `features/memory/server/shared.ts` for shared mappers and prompt/model helpers.
- Added `features/memory/server/brand-memory.ts` for brand memory permissions, CRUD, approvals, archival, and brand prompt block assembly.
- Added `features/memory/server/working-memory.ts` for thread working memory reads, prompt block assembly, refresh, and clear operations.
- Reduced `features/memory/service.ts` to a compatibility re-export facade.
- Updated server routes and `app/api/chat/route.ts` to import directly from the narrower server modules.
- Added focused tests in `features/memory/server/brand-memory.test.ts` and `features/memory/server/working-memory.test.ts`, and included `features/memory/server/*.test.ts` in the standard `pnpm test` script.

**Acceptance Criteria:**
- Existing imports from `@/features/memory/service` still work.
- New server code imports directly from the narrower module.
- Working memory model selection is not hardcoded inside the large service facade.

---

## Phase 3: Chat Finalization And Persistence

**Goal:** make message persistence, image upload, token usage, and billing independently testable while preserving route simplicity.

**Files:**
- `features/chat/server/persistence.ts`
- new `features/chat/server/finalization.ts`
- optional `features/chat/server/message-persistence.ts`
- optional `features/chat/server/token-usage.ts`

**Problem:** `persistChatResult()` uploads inline images, replaces messages, preserves compare/team rows, inserts media assets, deducts credits, records token usage, and updates the thread. These operations have different failure modes.

**Implementation:**

Extract narrow modules:

```typescript
export async function preparePersistableChatMessages(input): Promise<{
  messages: ChatMessage[];
  assets: typeof mediaAsset.$inferInsert[];
}>;

export async function saveChatMessagesAndThread(input): Promise<void>;

export async function recordChatTokenUsage(input): Promise<void>;

export async function finalizeChatBilling(input): Promise<void>;
```

Then keep a high-level finalization module:

```typescript
export async function finalizeChatTurn(input): Promise<void>;
```

The route should call the high-level finalizer. It should not know the billing choreography.

**Important Ordering:**
1. Normalize message IDs and upload inline images.
2. Save messages and media assets.
3. Update thread preview/title/brand.
4. Record token usage.
5. Deduct credits.

If a step should be best-effort, make that explicit in the function name or call site. Do not hide failures with broad catches unless the product intentionally allows the run to continue.

**Tests:**
- Message save works without image parts.
- Inline image parts are uploaded only for authenticated users.
- Compare/team-run messages are preserved.
- Token usage insert failure does not corrupt saved messages.
- Billing failure is surfaced or logged according to the chosen policy.

**Status:** Completed.

**Progress update:**
- Added `features/chat/server/finalization.ts` so `app/api/chat/route.ts` now makes one finalization call per text/image path.
- Added `features/chat/server/finalization-helpers.ts` for DB-free response/follow-up preparation helpers.
- Added `features/chat/server/message-persistence.ts` for stable message IDs, optional inline image upload, preserved compare/team row selection, insert-row shaping, and thread preview/title update values.
- Added `features/chat/server/token-usage.ts` for isolated token usage row construction.
- Added `features/chat/server/billing.ts` for isolated chat billing finalization.
- Reduced `features/chat/server/persistence.ts` to a high-level coordinator that composes the narrower modules in the documented order.
- Added focused tests in `features/chat/server/finalization.test.ts`, `message-persistence.test.ts`, `token-usage.test.ts`, and `billing.test.ts`.

**Acceptance Criteria:**
- `app/api/chat/route.ts` has one finalization call per text/image path.
- Message persistence tests do not need to mock credit deduction.
- Billing tests do not need to mock R2 image upload.

---

## Phase 4: Internal `prepareAgentRun()` Stages

**Goal:** keep the public `prepareAgentRun()` interface stable while making its implementation deeper and testable.

**Files:**
- `features/agents/server/run-service.ts`
- new `features/agents/server/run-agent-context.ts`
- new `features/agents/server/run-skills-tools.ts`
- new `features/agents/server/run-model.ts`
- new `features/agents/server/run-prompt.ts`
- existing `features/agents/server/runtime.ts`

**Problem:** `run-service.ts` coordinates agent lookup, memory, skills, brands, domain profiles, tools, model routing, prompt assembly, image handling, and response repair. It is difficult to test one concern without constructing a whole agent run.

**Implementation:**

Extract internal stages:

```typescript
resolveRunAgentContext(request, channelContext)
resolveRunSkillsAndTools(input)
resolveRunModel(input)
buildRunPrompt(input)
```

Keep these seams internal to `features/agents/server`. Do not expose them to routes until there are at least two real callers.

Move agriculture-specific output repair out of `run-service.ts` after the stage extraction is stable. Prefer a domain response module that activates from skill/runtime context, not from hardcoded platform-core assumptions.

**Tests:**
- `prepareAgentRun()` snapshot-style tests for web, LINE, and shared-link policies.
- Skill-unlocked tools merge with base tools.
- Tool-disabled models remove tools and gated prompt blocks.
- Brand blocking errors still surface as before.
- Domain setup block appears only when appropriate.

**Progress update:**
- Added `features/agents/server/run-model.ts` as the first extracted internal stage from `prepareAgentRun()`.
- Moved enabled-model filtering, manual/agent-default model selection, context token estimation, routing fallback, credit-cost resolution, and tool-gating into the internal run-model stage.
- Added `features/agents/server/run-context.ts` for agent lookup, memory resolution, skill runtime resolution, brand runtime resolution, and domain prompt context/setup resolution.
- Added `features/agents/server/run-tools.ts` for tool ID resolution and tool set construction, including lazy loading to keep pure helper tests DB-free.
- Added `features/agents/server/run-prompt.ts` for prepared prompt assembly and plain-text channel response guidance.
- Kept `prepareAgentRun()` public input/output stable while turning `run-service.ts` into a compositor over internal stages.
- Added focused tests in `features/agents/server/run-model.test.ts`, `run-tools.test.ts`, and `run-prompt.test.ts`, and verified `features/agents/server/*.test.ts` passes.

**Acceptance Criteria:**
- Public `prepareAgentRun()` input and output stay compatible.
- `run-service.ts` becomes a compositor rather than the home of every rule.
- No route starts calling the new internal stage modules directly.

---

## Phase 5: Web Chat Route Trimming

**Goal:** reduce `app/api/chat/route.ts` without bypassing `prepareAgentRun()`.

**Files:**
- `app/api/chat/route.ts`
- new `features/chat/server/web-chat-identity.ts`
- new `features/chat/server/web-chat-context.ts`
- new `features/chat/server/web-active-agent.ts`
- new `features/chat/server/web-channel-context.ts`
- existing `features/chat/server/finalization.ts`

**Problem:** The route still owns too much web-specific setup: guest/auth resolution, starter agent fallback, prompt enhancement, summarization, memory blocks, image channel context, audit setup, stream finalization, and error completion.

**Implementation:**

Extract web-only helpers:

```typescript
resolveWebChatIdentity(req, requestHeaders)
resolveWebActiveAgent(input)
buildWebChannelContext(input)
buildWebFinishContext(input)
```

The route should read like:

```typescript
const identity = await resolveWebChatIdentity(...);
const body = requestSchema.parse(rawBody);
const chatContext = await resolveWebChatContext(...);
const channelContext = await buildWebChannelContext(...);
const preparedRun = await prepareAgentRun({ ..., channelContext });
await start audit and check credits;
return stream response with finalizeChatTurn(...);
```

**Tests:**
- Guest identity resolution.
- Authenticated identity resolution.
- Starter agent fallback when no `agentId` is provided.
- Missing starter template returns the same 409 condition.
- Web channel context includes memory, quiz, image, MCP credentials, and skill runtime overrides.

**Progress update:**
- Added `features/chat/server/web-chat-identity.ts` for web guest/auth identity resolution.
- Added `features/chat/server/web-active-agent.ts` for starter-agent fallback and first-user starter-template checks.
- Added `features/chat/server/web-channel-context.ts` for quiz context blocks, prompt enhancement, conversation summary resolution, and typed web channel context assembly.
- Added `features/chat/server/web-image-channel-context.ts` so image-specific channel prompt blocks stay separate from test-friendly web context helpers.
- Updated `app/api/chat/route.ts` to delegate identity resolution, active-agent fallback, prompt enhancement, summary building, image context assembly, and web channel context assembly to the new helper modules.
- Kept `prepareAgentRun()` as the single canonical run coordinator and the route still calls it exactly once.
- Restored chat finalization through `finalizeImageChatTurn()` and `finalizeTextChatTurn()`, keeping one high-level finalization call per stream path.
- Added focused tests in `features/chat/server/web-channel-context.test.ts` and verified the full `pnpm test` suite passes.

**Acceptance Criteria:**
- The route still calls `prepareAgentRun()` exactly once.
- The route remains the orchestration layer for HTTP response decisions.
- No business logic moves from `prepareAgentRun()` into web-only helpers.

---

## Non-Goals

- Do not rewrite `prepareAgentRun()` into a new public coordinator.
- Do not move tool guidance into route-level prompt blocks.
- Do not extract every small function merely for file length.
- Do not change user-visible behavior during structural phases unless a test proves the existing behavior is broken.
- Do not make routes import domain `service.ts` modules that should only run behind tool or agent seams.

---

## Suggested PR Slices

1. `routing-intent.ts` extraction plus tests.
2. `getModelUserScore()` extraction if needed.
3. Memory file split with `service.ts` re-export facade.
4. Working memory tests.
5. Chat message persistence split.
6. Chat finalization wrapper.
7. Internal `prepareAgentRun()` stage extraction.
8. Agriculture response repair module extraction.
9. Web chat route helper extraction.

Each PR should be mergeable on its own and should keep existing imports working unless the PR explicitly migrates call sites.

---

## Verification Commands

Use `pnpm` only.

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

If the repo has no matching test command for a phase, add focused tests near the changed module and run the narrowest available command.

---

## Completion Checklist

- [x] New module has a smaller interface than the code it replaced.
- [x] The old caller no longer needs to know the moved implementation details.
- [x] The module passes the deletion test.
- [x] Tests exercise the new interface, not private implementation trivia.
- [x] Routes still orchestrate HTTP concerns only.
- [x] `prepareAgentRun()` remains the canonical agent-run preparation seam.
- [x] Client code does not import server-only modules.
- [x] No business logic is duplicated between route, agent adapter, and service module.
