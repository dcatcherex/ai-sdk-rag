# Architecture Deepening Guide — Round 3

> Audience: AI coders and developers continuing after `architecture-deepening-guide.md` (Round 2, Phases 1–6, all complete).
> Source: full-codebase architecture audit (July 2026) against `CONTEXT.md` domain terms and `docs/adr/`.
> Vocabulary: module / interface / seam / adapter / depth / locality / leverage — same as Round 2.

## Audit summary — what's healthy, what isn't

**Healthy (do not touch):**
- The Skills Engine is genuinely deep: `resolveSkillRuntimeContext(skills, userMessage)` in `features/skills/server/activation.ts` hides trigger detection, LLM discovery, resource selection, and all three prompt tiers behind one call.
- The tool architecture rule (one canonical `service.ts`, thin `agent.ts`/routes) is followed consistently across all 26 registered tools.
- The finalization core (`finalizeTextChatTurn` → `persistChatResult` → `finalizeChatBilling`) is a coherent layered chain with a typed failure taxonomy (Round 2 Phase 3 delivered this).
- Prompt assembly is centralized in `buildResolvedPromptContext` (`prompt-context.ts`, 16-slot canonical section order) — Round 2 Phase 1.

**The friction (this round):** the Conversation Turn Runtime (`ADR-0001`) exists but is shallow and unevenly adopted; LINE forked persistence/billing; credits move through ~9 independent paths; most feature services have no test seam.

## Progress

| Phase | Status | Candidate |
|-------|--------|-----------|
| 0 Quick wins | ⬜ Not started | dead code, stale docs, duplicate barrels |
| 1 Shared Turn Finalization (LINE) | ⬜ Approved, planned in detail | forked LINE persistence/billing |
| 2 Deepen the Conversation Turn Runtime | ⬜ Not started | shallow runtime, web route bypass |
| 3 Credit Billing seam | ⬜ Not started | ~9 independent billing paths |
| 4 Service testability seams (policy) | ⬜ Not started | DB + AI SDK hard imports |

**Rules carried over from Round 2:** deletion test for every new module; strangler pattern (new facade first, old entry points forward, delete after migration + clean `pnpm exec tsc --noEmit`); contract tests before moving internals.

**Decision records:** `docs/adr/0001-conversation-turn-runtime.md` (runtime/adapter split — enforced by Phases 1–2, never re-litigated), `docs/adr/0002-shared-turn-finalization.md` (one finalizer, Channel Persistence Adapters, LINE bills channel owner).

---

## Phase 0: Quick Wins

Zero-risk cleanups. Do in one commit, any time.

1. **Delete dead `mergeAgentToolIds`** — `features/agents/server/runtime.ts` (~L73–80). Duplicate of the live `resolveRunToolIds` (`features/agents/server/run-tools.ts` ~L65); not called on the production path. Verify with grep before deleting.
2. **Collapse the duplicate skills barrels** — `features/skills/service.ts` (63-line barrel) and `features/skills/server/runtime.ts` (11-line barrel) export overlapping functions. Keep `service.ts` as the single public barrel; migrate the few `server/runtime.ts` importers; delete it.
3. **Fix stale skill-function names in CLAUDE.md and AGENTS.md** (~L354 in each): `selectModelDiscoveredSkills()` and `getRelevantSkillResourcesForPrompt()` no longer exist. Actual names: `runLlmSkillDiscovery` (`features/skills/server/llm-discovery.ts`), `getResolvedSkillResourcesForPrompt` (`features/skills/server/resources.ts`). AI coders navigate by these docs — stale names cost real time.
4. **Record, don't fix:** agent-team specialists never receive skill-unlocked tools or skill prompt blocks (`features/agent-teams/server/run-steps.ts` ~L113–118 builds tools from `member.agent.enabledTools` only). Agent-teams is maintenance-only per the product vision; open an issue so the gap is a decision, not an accident.

**Acceptance:** tsc clean, tests green, grep finds no references to deleted symbols, CLAUDE.md function names match the code.

---

## Phase 1: Shared Turn Finalization — LINE onto the one pipeline

**Full plan (approved, step-by-step):** `docs/guide/shared-turn-finalization-refactor-plan.md`. This section is the summary; implement from that document.

### Problem

LINE turns bypass finalization entirely: no billing (channel owner is never charged despite `billingUserId` being resolved), no token metering, no audit. `persistLineTurn` is duplicated byte-identically in `features/line-oa/webhook/events/text-replies.ts` (~L109) and `farm-records.ts` (~L221) with ~18 call sites. `finalizeLineTextConversationTurn` (`conversation-turn.ts` ~L211) is a LINE-only finalizer inside the shared runtime that takes ~18 fields including two injected callbacks — the caller supplies the behavior the module should own. LINE also resolves skills (including the paid LLM discovery call) twice per text turn.

### Solution (decided)

One finalizer for all channels. Persist becomes a real seam with two production adapters: web full-thread rewrite (`persistChatResult`, minus the billing/metering that get hoisted into the finalizer as named steps) and a new LINE append-only adapter (`persistLineAppendTurn`, the single descendant of both `persistLineTurn` copies). Suggestions generation moves to the LINE Channel Adapter (transport policy). Finish context gains `billingUserId` and `lineUserId`. All LINE paths — canonical AI reply and the ~6 direct-intent shortcuts — finalize through the shared pipeline with explicit `creditCost` (model cost for AI turns, media cost for image/video, 0 for lookups).

### Benefits

Locality: one place where a Conversation Turn becomes durable and billed, for every channel. Leverage: LINE billing, metering, and audit go live by adoption, not by new code per path. Cost: halves the skill-discovery LLM call per LINE text turn. Tests: LINE turn semantics become testable through the finalization interface with a fake persistence adapter.

---

## Phase 2: Deepen the Conversation Turn Runtime — and port the web route onto it

Depends on Phase 1 (deleting `finalizeLineTextConversationTurn` first shrinks the runtime's surface).

### Problem

`features/agents/server/conversation-turn.ts` (282 lines) exposes 9 functions that callers must sequence themselves: `prepareConversationTurn` → `streamConversationTurnText`/`runConversationTurnText` → `buildConversationTurnFinishContext` → `finalizeConversationTurnText`. The interface is nearly as complex as the implementation — a wide, shallow module. Concretely:

- `buildConversationTurnFinishContext` takes a **14-field config object**; the finish-context literal is copy-pasted at ~5 call sites (`app/api/chat/route.ts` ~L192–206, ~L419–433; `app/api/agent/[token]/chat/route.ts` ~L199–213, ~L333–345, ~L417–429).
- **The busiest channel bypasses the runtime entirely.** `app/api/chat/route.ts` (607 lines) never calls `prepareConversationTurn`; it imports `prepareAgentRun` directly (~L337) and re-implements the turn inline: skill detection (~L172, duplicating `run-context.ts` ~L104), task-flow resolution + the `needs_more_info` intercept (~L182–233), channel-context/prompt assembly (~L289–335), model routing (~L284–287), the credit gate (~L400–414), audit run management (~L368–395), and direct `finalizeTextChatTurn` calls (~L189, ~L493, ~L555). It then hand-builds a `PreparedConversationTurn` object literal (~L535–548) to feed `streamConversationTurnText`.
- The `needs_more_info` streaming intercept (~55 lines) is duplicated near-verbatim between `app/api/chat/route.ts` (~L182–233) and `app/api/agent/[token]/chat/route.ts` (~L187–242).
- Deletion test result: deleting `conversation-turn.ts` today would barely affect the web channel — proof it is a pass-through, not a deep module. The real depth lives in `run-service.ts` (`prepareAgentRun`, 666 lines) and `finalization.ts`.

### Solution

Deepen, don't add a coordinator (Round 2 core rule). Three moves, strangler-pattern order:

1. **Absorb the finish context.** `PreparedConversationTurn` already knows `threadId`, `modelId`, `creditCost`, `activeBrand`, `lastUserPrompt`. Change `prepareConversationTurn` to accept the channel-supplied finish fields up front (identity, memory flags, memoryContext, currentTitle, chatRunId) and return a turn whose `finalizeText(updatedMessages, usage)` / `finalizeImage(...)` need **no further context**. The 14-field literal disappears from every route; `buildConversationTurnFinishContext` becomes internal.
2. **Absorb the task-flow intercept.** Extract the duplicated `needs_more_info` streaming branch into one runtime-owned helper (`interceptTaskFlowNeedsMoreInfo(turn)` returning a stream-or-null), consumed by both web and shared-link adapters. LINE keeps its own reply-shaped variant but the decision logic is shared.
3. **Port `app/api/chat/route.ts` onto the runtime.** Replace the inline turn body with `prepareConversationTurn` + the channel context it already supports (`skillRuntimeOverride`, `toolAdapter`, `extraBlocks` — the shared-link route at `app/api/agent/[token]/chat/route.ts` ~L246 is the working reference implementation). Web-only concerns stay in the route: auth, request parsing, model-score routing inputs, the 402 gate, response streaming. Target: the route shrinks from ~607 lines to a Channel Adapter in the 150–250 range.

### Migration

Strangler: implement move 1 with the old exports forwarding; migrate shared-link route (smallest diff, already runtime-shaped); migrate web route; delete the old exports + duplicated intercept blocks. One commit per move.

### Tests

- Contract test: `prepareConversationTurn` + fake finalization impl → asserts prepare/execute/finalize ordering, credit cost propagation, task-flow prompt application — through the runtime interface, no route involved.
- The intercept helper gets a direct unit test (currently only testable by exercising two routes).
- Existing `conversation-turn.test.ts` and route-level behavior stay green; web chat manual turn (text + image + task-flow) verified before deleting old exports.

### Acceptance

- `app/api/chat/route.ts` calls `prepareConversationTurn`; no direct `prepareAgentRun`, `finalizeTextChatTurn`, or hand-built `PreparedConversationTurn` literals in any route (grep).
- Zero copies of the finish-context literal and the `needs_more_info` intercept outside the runtime.
- Deletion test now passes in the right direction: deleting `conversation-turn.ts` would strand all three channels.

---

## Phase 3: Credit Billing seam

Independent of Phase 2; do after Phase 1 (which hoists chat billing into the finalizer and adds `billingUserId`).

### Problem

`getCreditCost`/`deductCredits`/`addCredits` are called inline from ~9 independent paths, each re-implementing *check balance → run → deduct → log* with different ordering:

| Path | Where | Notes |
|---|---|---|
| Media routes | `lib/api/creditGate.ts` (`checkAndDeductCredits`, `refundGenerationCredits`) via `app/api/{image,audio,video,speech}` | the closest thing to a gate module today |
| Web/LINE chat | finalizer billing step (after Phase 1) | has an injected seam + tests |
| Shared-link | `app/api/agent/[token]/chat/route.ts` inline `getUserBalance` + `deductCredits` | hand-rolled |
| Agent-teams | `run-steps.ts` (×2), `planner-run.ts`, `run-engine.ts` | own multi-step accounting |
| Compare | `app/api/compare/route.ts` | ×2, one per model |
| Website builder | `lib/website-service.ts` | **hard-coded `COST` in 3 functions, bypasses `getCreditCost` entirely** |
| Support / image edit | `lib/support.ts`, `app/api/images/edit/route.ts` | inline recompute + deduct |

The product's Phase 1.5 unit-economics gate (≥50% margin per credit) is unenforceable while cost computation has no single home.

### Solution

One billing module (suggested: `lib/billing/turn-billing.ts`, or extend `lib/api/creditGate.ts` — pick whichever passes the deletion test after consolidation) with a small interface:

```ts
gate({ userId, cost }): Promise<{ ok: true } | { ok: false; balance: number }>   // pre-run check
charge({ userId, cost, description, threadId? }): Promise<void>                   // post-run deduct + log
refund({ userId, amount, reason }): Promise<void>                                 // failure paths
costFor(modelId): number                                                          // wraps getCreditCost; the ONLY public cost entry
```

`lib/credits.ts` primitives become implementation details behind it. Website-builder's hard-coded `COST` moves into the model-cost table or an explicit product-priced entry — no more literals at call sites.

### Migration

Consolidate one path per commit, riskiest last: creditGate wrapper → shared-link route → compare → support/image-edit → website-builder (pricing decision needed: keep current effective prices) → agent-teams (most intricate; per-step accounting keeps its loop but calls `charge` per step).

### Tests

Billing invariants tested once at the module: no deduct when gate fails, deduct exactly once per charge, refund restores, description format stable (`buildChatBillingDescription` reused). Per-path migration verified by asserting identical `creditTransaction` rows before/after (manual or characterization test).

### Acceptance

- `deductCredits` is imported by exactly two files: the billing module and the finalizer's default impl (grep).
- No hard-coded credit literals outside the pricing table.
- `getCreditCost` not imported by any route or feature service directly.

---

## Phase 4: Service testability seams — a policy, not a project

### Problem

~5% of source files have tests, and the untested set is exactly the modules with no seam: 24 of 44 feature `service.ts` files import `{ db } from '@/lib/db'` at module scope; 10 services hard-import `generateText` from `ai` plus `getModelSlot` (which itself imports the DB). Evidence of pain: `features/case-workspace/service.test.ts` must fake `DATABASE_URL` and lazy-require just to load the module, then can only test pure helpers. The hidden interface of these services includes "a live Postgres and an AI provider."

### Solution — two standing rules, applied opportunistically (never as a big-bang)

1. **Queries convention:** when you touch a feature service, move its Drizzle access into `features/<feature>/server/queries.ts` / `mutations.ts` (8 features already follow this: agents, chat, skills, user-tools, domain-profiles, agent-teams, workspace-ai, chat/audit). Service functions take data or call the query module; they stop importing `db` at module scope.
2. **Model-call seam:** when you touch a service that calls `generateText`/`generateObject`, accept the generate function (or a `modelCaller`) as an optional parameter defaulting to the real one — the exact pattern `features/agents/server/run-model.ts` already uses for `getCreditCostForModel`, proven testable in `run-model.test.ts`. The second adapter (the test fake) is what makes the seam real.

Priority order when choosing what to touch deliberately: services on the money path first — `features/line-oa/payment/service.ts` (PromptPay/slip verification: revenue-critical, DB-inline, zero tests today), then `lib/credits.ts`, then high-churn content services.

### Acceptance (per touched service)

Module loads without `DATABASE_URL`; at least one behavior test through the service interface with fake queries/model; no new module-scope `db` imports pass review. Add both rules to CLAUDE.md's "Common Patterns" once the first migration lands, so AI coders apply them by default.

---

## Recommended order & sizing

| Order | Phase | Size | Depends on |
|---|---|---|---|
| 1 | Phase 0 quick wins | ~½ day | — |
| 2 | Phase 1 LINE finalization | ~4–6 days | detailed plan doc |
| 3 | Phase 3 billing seam | ~2–3 days | Phase 1 |
| 4 | Phase 2 runtime deepening + web port | ~4–6 days | Phase 1 |
| 5 | Phase 4 testability policy | ongoing | first application: payment service |

Phases 2 and 3 are independent of each other; 3 before 2 gets the revenue-correctness win sooner and keeps the web-route port (the largest diff) last, when the runtime and billing interfaces are both stable underneath it.

## Stop conditions

Stop and reassess if: a phase's diff grows past ~2× the estimate; web chat behavior changes in any observable way during Phases 1–3 (billing amounts, message rows, stream shape); or a new top-level coordinator module starts to look necessary — that's the signal you're adding indirection instead of depth. Re-read the deletion test.
