# Architecture Deepening Guide — Round 2

> Audience: AI coders and developers continuing the codebase architecture work after platform-refactor-implementation-plan.md (Phases 1–5).
> Purpose: implement six deepening opportunities in the correct order, with explicit seams, typed contracts, and stop conditions.

## Progress

| Phase | Status | Key files |
|-------|--------|-----------|
| 1 PromptContext | ✅ Complete | `features/chat/server/prompt-context.ts`, `run-prompt.ts`, `runtime.ts`, `run-service.ts` |
| 2 ModelSelector | ✅ Complete | `features/chat/server/model-selector.ts`, `lib/ai.ts` (`capabilityTier`), `run-model.ts` |
| 3 Finalization contract | ✅ Complete | `features/chat/server/finalization.ts` (`FinalizationResult`), `finalization-helpers.ts` (lazy imports), `app/api/chat/route.ts` |
| 4 Tool builder unification | ✅ Complete | `features/agents/server/run-tools.ts` (`buildToolsForRun`, `ToolBuildInput`), `lib/agent-tools.ts` deleted, `run-engine.ts`, `lib/support.ts` |
| 5 Agent-team run-path split | ✅ Complete | `specialist-helpers.ts`, `run-steps.ts`, `sequential-run.ts`, `planner-run.ts`, `run-engine.ts` (dispatcher) |
| 6 Response-format module split | ✅ Complete | barrel `index.ts` deleted; 11 callers migrated to direct sub-module imports (`types.ts`, `contracts.ts`, `service.ts`, `template-registry.ts`, `server/select.ts`, `server/audit.ts`, `channels/line.ts`, `channels/web.ts`) |

**Test baseline:** 115 total, 109 pass, 6 fail (6 pre-existing DB-init failures; Phase 5 added 15 pure-helper tests, all pass)

---

## Core Rule

The same rule from the previous plan applies: **deepen existing modules before creating new top-level coordinators.**

Every new module must pass the deletion test: if you deleted it, would complexity concentrate in one place (the new module earns its keep) or scatter back across callers (it was a shallow pass-through)?

---

## Implementation Guardrails

These apply to every phase in this guide.

**Strangler pattern.** Add new facades first. Keep old entry points as thin wrappers that forward to the new module. Remove the old entry point only after all callers are migrated and a full type-check passes.

**Contract tests before moving internals.** Write tests against the new typed output *before* migrating the implementation. The tests define the contract; the migration satisfies it.

**Reason payloads only where observable.** Structured `reason` fields in outputs add value when the output is externally observable (model selection, finalization failures, audit logs). Do not add them as a universal logging convention to every module.

**Failure taxonomy for finalization only.** Two classes: `fatal` (return an error, do not persist) and `best_effort_failed` (log, continue, do not surface to caller). Drop the `deferred` class — it implies a retry queue that does not yet exist.

---

## Refactor Order

| # | Phase | Why this order |
|---|-------|---------------|
| 1 | PromptContext | No upstream dependency; unblocks ModelSelector |
| 2 | ModelSelector | Takes `ResolvedPromptContext` as input; richer `reason` for free |
| 3 | Finalization contract | Highest data-correctness risk; independent of 1 & 2 |
| 4 | Tool builder unification | Safer after model/prompt seams are typed |
| 5 | Agent-team run-path split | Isolated to `agent-teams/server/`; independent of 1–4 |
| 6 | Response-format module split | Broadest surface; cleaner once upstream contracts are typed |

---

## Phase 1: PromptContext — Owned Prompt Assembly

**Goal:** give the system one place that owns what the LLM receives.

### Problem

To understand the actual system prompt, you trace through 7+ files:

- `features/chat/server/web-channel-context.ts` — assembles context blocks
- `features/agents/server/run-service.ts` — calls `buildPreparedRunPrompt()`
- `features/agents/server/runtime.ts` — resolves runtime
- `lib/memory.ts` — user memory retrieval
- `features/memory/server/working-memory.ts` — thread working memory
- `features/memory/server/brand-memory.ts` — brand instructions
- `features/chat/server/prompt-assembly.ts` — final concatenation

Memory blocks, skill resources, brand instructions, and conversation summary are each fetched in a different module and passed as untyped strings through 4 call layers. No single module owns "what goes into the prompt."

### Solution

Extract `features/chat/server/prompt-context.ts`:

```typescript
export type PromptSection =
  | { type: "memory"; content: string }
  | { type: "working_memory"; content: string }
  | { type: "brand"; content: string; brandId: string }
  | { type: "skills_catalog"; content: string }
  | { type: "active_skills"; content: string }
  | { type: "skill_resources"; content: string }
  | { type: "conversation_summary"; content: string };

export type ResolvedPromptContext = {
  sections: PromptSection[];
  /** Estimated token count of all injected sections. */
  estimatedInjectionTokens: number;
  /** The final assembled system prompt string. */
  systemPrompt: string;
};

export async function resolvePromptContext(input: {
  userId: string;
  threadId: string;
  agentId: string | null;
  message: string;
  skills: LoadedSkill[];
  brandResolution: BrandResolution | null;
  conversationSummary: string | null;
  baseSystemPrompt: string;
}): Promise<ResolvedPromptContext>;
```

`resolvePromptContext` is responsible for:
1. Fetching user memory and building `memory` section
2. Fetching thread working memory and building `working_memory` section
3. Applying brand instruction as `brand` section
4. Assembling skill catalog, active skills, and skill resources sections
5. Injecting conversation summary as `conversation_summary` section
6. Concatenating all sections onto `baseSystemPrompt` in canonical order

**Important:** `resolvePromptContext` does not select the model. It only assembles what the LLM will receive. Model selection reads `ResolvedPromptContext` after this step.

### Migration

1. Create `features/chat/server/prompt-context.ts` with the types and the new function.
2. Write contract tests (see below) against the new output.
3. Move retrieval calls from `web-channel-context.ts` and `run-service.ts` into `resolvePromptContext`.
4. Update `prepareAgentRun()` in `run-service.ts` to call `resolvePromptContext()` and receive a `ResolvedPromptContext`.
5. Keep `web-channel-context.ts` as a compatibility shim exporting the old names, forwarding to the new module.
6. Remove the shim once all callers are migrated.

### Tests

- All sections present in output when all inputs are non-null.
- Missing optional inputs (no brand, no skills, no summary) produce correct section list with those sections absent.
- `estimatedInjectionTokens` is zero when all optional inputs are absent.
- `systemPrompt` contains `baseSystemPrompt` as prefix.
- Section order is canonical regardless of which optional inputs are present.

### Acceptance Criteria

- `prepareAgentRun()` receives one `ResolvedPromptContext` instead of threading 4+ string blocks.
- No route imports retrieval functions directly (memory, working-memory, brand) — only `resolvePromptContext`.
- The deletion test passes: removing `prompt-context.ts` would scatter retrieval calls across the chat route and run-service.

---

## Phase 2: ModelSelector — Unified Model Selection

**Goal:** make model selection a single, auditable seam.

### Problem

Why a model was selected requires tracing through 5 files:

- `lib/ai.ts` — `isStrongModel()` uses `inputCost >= 0.5` as a capability heuristic
- `features/chat/server/routing.ts` — `getModelByIntent()` combines intent + ranking
- `features/chat/server/routing-intent.ts` — `detectRoutingIntent()` (from Phase 1 of prior plan)
- `features/agents/server/run-model.ts` — `resolveRunModel()` wraps the above + adds tool-support check
- `lib/ai-config.ts` — slot-based model overrides

The `isStrongModel()` cost heuristic breaks silently when a cheap-but-capable model is released. There is no audit trail explaining *why* a model was chosen.

Additionally, `ResolvedPromptContext.estimatedInjectionTokens` (from Phase 1) is not yet used in model selection — a context-heavy prompt should prefer a model with a larger context window.

### Solution

Extract `features/chat/server/model-selector.ts`:

```typescript
export type ModelSelectionReason =
  | "image_intent"
  | "web_intent"
  | "code_intent"
  | "reasoning_intent"
  | "agent_override"
  | "slot_config"
  | "user_score"
  | "context_window_required"
  | "default";

export type ModelSelection = {
  modelId: string;
  reason: ModelSelectionReason;
  supportsTools: boolean;
  estimatedInputTokens: number;
};

export async function selectModel(input: {
  userId: string;
  agentId: string | null;
  promptContext: ResolvedPromptContext;
  intent: RoutingIntent;
  userScores?: ModelScoreMap;
}): Promise<ModelSelection>;
```

Replace `isStrongModel()` cost heuristic with an explicit capability tier declared on each model definition in `lib/ai.ts`:

```typescript
export type ModelCapabilityTier = "standard" | "strong" | "reasoning";

export type ModelOption = {
  // ... existing fields ...
  capabilityTier: ModelCapabilityTier;
};
```

`selectModel` uses `capabilityTier` instead of the cost proxy. The `reason` field is logged to the audit trail.

### Migration

1. Add `capabilityTier` to every `ModelOption` in `lib/ai.ts`.
2. Create `features/chat/server/model-selector.ts` with types and `selectModel()`.
3. Write contract tests (see below).
4. Update `resolveRunModel()` in `run-model.ts` to call `selectModel()` and return `ModelSelection`.
5. Update callers to read `modelSelection.modelId` and `modelSelection.supportsTools`.
6. Remove `isStrongModel()` from `lib/ai.ts` once no callers reference it.

### Tests

- Image-intent prompt selects an image-capable model with `reason: "image_intent"`.
- Agent with explicit model override returns that model with `reason: "agent_override"`.
- High `estimatedInjectionTokens` selects a large-context model over a short-context one.
- `supportsTools: false` for models in `toolDisabledModels`.
- Slot config override takes precedence over user score.

### Acceptance Criteria

- `isStrongModel()` is deleted; capability is declared on each model definition.
- Every model selection in the system emits a `ModelSelection` with a non-null `reason`.
- `ModelSelection` is logged alongside the chat run in the audit trail.
- `run-model.ts` becomes a thin wrapper or is inlined into `prepareAgentRun()`.

---

## Phase 3: Finalization Contract — ChatTurnFinalizer

**Goal:** define what "a turn is finalized" means and prevent silent state divergence.

### Problem

After each chat turn, `finalizeChatTurn()` in `features/chat/server/finalization.ts` calls 5 independent async operations:

1. `preparePersistableChatMessages()` — message normalization
2. `saveChatMessagesAndThread()` — DB write
3. `refreshThreadWorkingMemoryFromMessages()` — working memory update
4. `extractAndStoreMemory()` — user fact extraction
5. `completeChatRunSuccess()` — audit

There is no transaction. If step 3 fails, step 4 still runs. Messages are persisted but working memory is stale. This is silent divergence — no error surfaces, no rollback, no retry signal.

### Solution

Define explicit failure classes and a typed finalization result:

```typescript
export type FinalizationStepName =
  | "message_persistence"
  | "working_memory"
  | "memory_extraction"
  | "audit";

export type FinalizationFailure = {
  step: FinalizationStepName;
  class: "fatal" | "best_effort_failed";
  error: unknown;
};

export type FinalizationResult =
  | { ok: true }
  | { ok: false; failure: FinalizationFailure };
```

Classify each step:

| Step | Class |
|------|-------|
| `message_persistence` | `fatal` — do not proceed without messages saved |
| `working_memory` | `best_effort_failed` — log, continue |
| `memory_extraction` | `best_effort_failed` — log, continue |
| `audit` | `best_effort_failed` — log, continue |

Rewrite `finalizeChatTurn()` to:
1. Run message persistence; if it fails, return `{ ok: false, failure: { step: "message_persistence", class: "fatal" } }`.
2. Run remaining steps in parallel; collect `best_effort_failed` failures without throwing.
3. Return `{ ok: true }` if persistence succeeded, regardless of best-effort failures.
4. Log all `best_effort_failed` failures with structured context.

The route checks `result.ok`. Fatal failures surface as 500 responses. Best-effort failures are invisible to the caller but present in logs.

### Migration

1. Add the types above to `features/chat/server/finalization.ts`.
2. Write contract tests (see below).
3. Reorder the finalization body to match the new classification.
4. Update the route to check `result.ok` and return 500 on fatal failure.
5. Add structured log calls for `best_effort_failed` failures.

### Tests

- DB failure during `saveChatMessagesAndThread` returns `{ ok: false, failure: { class: "fatal" } }`.
- Working-memory failure returns `{ ok: true }` (best-effort).
- Memory-extraction failure returns `{ ok: true }` (best-effort).
- All best-effort failures emit a log entry with `step` and `error` fields.
- Successful run returns `{ ok: true }` with no failure.

### Acceptance Criteria

- The route never swallows a finalization error silently.
- `best_effort_failed` failures are queryable in logs by `step` name.
- Fatal failure on message persistence returns HTTP 500 with a consistent error shape.
- No new retry infrastructure — `deferred` is not a class.

---

## Phase 4: Tool Builder Unification

**Goal:** eliminate two parallel tool-building paths behind one interface.

### Problem

Two functions produce a `ToolSet` with different signatures:

- `buildToolSet({ enabledToolIds, userId, brandId, ... })` in `lib/tools/index.ts`
- `createAgentTools(toolIds, userId, documentIds, {...})` in `lib/agent-tools.ts`

The decision of which to call is buried in `features/agents/server/run-tools.ts` behind "does an agent exist?" Both do the same job with different parameter shapes. The two implementations have silently diverged (agent path has special document-ID filtering; general path does not).

### Solution

Extract `features/agents/server/run-tools.ts` into a single exported function:

```typescript
export type ToolBuildInput = {
  userId: string;
  enabledToolIds: string[];
  agentId?: string;
  brandId?: string;
  documentIds?: string[];
  teamRunId?: string;
};

export async function buildToolsForRun(input: ToolBuildInput): Promise<ToolSet>;
```

Internally, `buildToolsForRun` handles the agent vs. non-agent path. The caller does not know about the distinction.

### Migration

1. Create `buildToolsForRun` in `features/agents/server/run-tools.ts` (it already exists; extend it).
2. Write contract tests for both paths (with and without `agentId`).
3. Update `prepareAgentRun()` to call `buildToolsForRun`.
4. Delete `lib/agent-tools.ts` once `buildToolsForRun` covers its behavior.
5. Keep `buildToolSet` in `lib/tools/index.ts` as a low-level utility only if other non-agent callers use it directly. If not, delete it too.

### Tests

- No `agentId` → returns the same tool set as the old `buildToolSet` path.
- With `agentId` → agent-specific document-ID filtering applies.
- Empty `enabledToolIds` returns an empty `ToolSet`.
- Unknown tool ID is silently ignored (not thrown).

### Acceptance Criteria

- `lib/agent-tools.ts` is deleted or reduced to a private implementation detail.
- All callers use `buildToolsForRun`.
- The chat route never imports `buildToolSet` or `createAgentTools` directly.

---

## Phase 5: Agent-Team Run-Path Split

**Goal:** make sequential and planner execution independently readable and testable.

### Problem

`executeTeamRun()` in `features/agent-teams/server/run-engine.ts` contains a 150-line `if (isPlanner)` branch implementing two entirely different execution strategies in one function. The shared helper `buildSpecialistPrompt()` is called by both paths, but `priorSteps` is assembled differently in each — an undocumented invariant. Understanding one path requires reading code for the other.

### Solution

Extract two focused functions:

```typescript
// features/agent-teams/server/sequential-run.ts
export async function executeSequentialRun(input: TeamRunInput): Promise<TeamRunResult>;

// features/agent-teams/server/planner-run.ts
export async function executePlannerRun(input: TeamRunInput): Promise<TeamRunResult>;
```

`executeTeamRun` becomes a dispatcher:

```typescript
export async function executeTeamRun(input: TeamRunInput): Promise<TeamRunResult> {
  if (input.team.executionMode === "planner") {
    return executePlannerRun(input);
  }
  return executeSequentialRun(input);
}
```

Move shared helpers (`buildSpecialistPrompt`, `buildPriorStepsSummary`) to `features/agent-teams/server/specialist-helpers.ts`.

### Migration

1. Create `features/agent-teams/server/specialist-helpers.ts` with shared helpers.
2. Create `features/agent-teams/server/sequential-run.ts` with the sequential path extracted.
3. Create `features/agent-teams/server/planner-run.ts` with the planner path extracted.
4. Reduce `run-engine.ts` to the dispatcher.
5. Write path-specific tests.

### Tests

Sequential path:
- Steps run in member order.
- Each step's output feeds the next step's `priorSteps`.
- Step failure records error and halts the run.

Planner path:
- Orchestrator generates a plan before specialists run.
- Plan step assignments are respected.
- Specialist output is attributed to the correct plan step.

Shared:
- `buildSpecialistPrompt` with empty `priorSteps` produces a valid prompt.
- `buildSpecialistPrompt` with `priorSteps` includes summaries in output.

### Acceptance Criteria

- `run-engine.ts` is under 60 lines (dispatcher + imports only).
- Sequential and planner paths have no shared mutable state.
- Deletion test: deleting `sequential-run.ts` concentrates complexity back into `run-engine.ts` — the split is earning its keep.

---

## Phase 6: Response-Format Module Split

**Goal:** eliminate the barrel-induced god module.

> Complete Phases 1–5 first. Upstream contracts (PromptContext, ModelSelection, ToolBuildInput) being typed makes it possible to type response-format inputs precisely.

### Problem

`features/response-format/index.ts` exports 50+ names covering: contract normalization, template registry, safety inference, workflow postback building, channel-specific rendering, and fallback selection. These are distinct concerns with no shared invariant. Importing one requires entangling with all.

### Solution

Split into sub-modules with independent interfaces:

| Sub-module | Responsibility |
|-----------|---------------|
| `response-format/contracts.ts` | Normalize raw format config → `ResponseFormatContract` |
| `response-format/safety.ts` | Infer safety flags from model + content type |
| `response-format/selection.ts` | Select format given intent + channel + agent config |
| `response-format/templates.ts` | Registry of named response templates |
| `response-format/workflows.ts` | Build workflow postback payloads |
| `response-format/channels/` | Channel-specific rendering (web, line) — already split |

Each sub-module exports only what is needed for its concern. The barrel `index.ts` is replaced by explicit imports at each call site.

### Migration

1. Map every export in the current `index.ts` to its target sub-module.
2. Create sub-modules one at a time; keep the barrel exporting old names from new locations during migration.
3. Migrate call sites to import directly from sub-modules.
4. Remove the barrel once all call sites use direct imports.

### Tests

Each sub-module is independently testable without importing the others:
- `contracts.ts`: raw config → normalized contract.
- `safety.ts`: model ID + content type → safety flags.
- `selection.ts`: intent + channel → selected format (no template content needed).
- `templates.ts`: template name → template definition.

### Acceptance Criteria

- No single import brings in more than one concern.
- `index.ts` barrel is deleted.
- Adding a new template requires touching only `templates.ts`.
- Adding a new channel requires touching only `channels/`.

---

## Stop Conditions

Each phase is complete when:

1. All contract tests pass.
2. `pnpm exec tsc --noEmit` passes with no new errors.
3. Old entry points are deleted (not left as permanent stubs).
4. The deletion test holds for every new module introduced.
