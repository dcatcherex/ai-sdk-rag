# Agent Teams — Implementation Reference

> **Audience:** AI coders and developers maintaining or extending this feature.
> **Last updated:** Enhancement phases complete — specialist tool use, templates, plan preview, output contracts shipped.

---

## Table of Contents

1. [What it does](#1-what-it-does)
2. [Architecture overview](#2-architecture-overview)
3. [Database schema](#3-database-schema)
4. [Server engine](#4-server-engine)
   - 4.1 [queries.ts](#41-queriests)
   - 4.2 [orchestrator.ts](#42-orchestratorts)
   - 4.3 [run-engine.ts](#43-run-enginets)
5. [API routes](#5-api-routes)
6. [Frontend](#6-frontend)
   - 6.1 [Hooks](#61-hooks)
   - 6.2 [Components](#62-components)
7. [Streaming protocol](#7-streaming-protocol)
8. [Credit system integration](#8-credit-system-integration)
9. [Thread integration](#9-thread-integration)
10. [Adding or changing things](#10-adding-or-changing-things)
11. [Known limitations](#11-known-limitations)
12. [Future extensions](#12-future-extensions)

---

## 1. What it does

Agent Teams lets users compose multiple AI agents into a coordinated team that works together to answer a complex prompt. One agent acts as the **orchestrator** (plans and synthesises), the rest are **specialists** (each handles a focused sub-task).

Two routing strategies are supported:

| Strategy | Behaviour |
|----------|-----------|
| `sequential` | All specialists run in position order; sub-prompts built from accumulated context |
| `planner_generated` | Orchestrator runs a planning step first, selects which specialists to use and writes focused sub-prompts for each. Users can preview and edit the plan before committing credits. |

Additional capabilities:

- **Specialist tool use** — specialists can call any tool in their `enabledTools` list (web search, RAG, image gen, etc.) during their step
- **Team templates** — 4 built-in blueprints (Content Pipeline, Marketing Campaign, Product Discovery, Support Triage) provide a starting point without a blank builder
- **Output contracts** — the synthesised output can be plain markdown, structured JSON, or named sections
- **Run history** — all runs and individual steps are persisted and viewable
- **Thread integration** — run output can be saved to a chat thread

---

## 2. Architecture overview

```
Browser
  └── /agent-teams page
        └── TeamsList
              ├── TeamBuilderPanel      (configure)
              ├── TeamChatInterface     (run)
              └── TeamRunHistory        (history)

TeamChatInterface
  └── useTeamChat hook
        │
        │ [planner_generated only — two-phase]
        ├── POST /api/team-chat/plan   → returns PlanPreviewResponse (no credits)
        │     └── generatePlan()
        │         (user reviews/edits plan steps in UI)
        │
        └── POST /api/team-chat        ← approvedPlan? included if plan was previewed
              └── executeTeamRun()
                    ├── [planner_generated] generatePlan() OR use approvedPlan
                    ├── specialist loop → generateText(tools?) per agent
                    ├── synthesizeWithOrchestrator()
                    └── [if threadId] insert chatMessage rows

Streaming (Vercel AI SDK UIMessageStream)
  server writes:  message-metadata { teamUpdates[] }   ← step progress
                  text-start / text-delta / text-end   ← final output
  client reads:   readUIMessageStream({ stream })
                  message.metadata.teamUpdates → activity feed
                  message.parts[text].text     → output display
```

**Key invariant:** the orchestrator agent is called twice in `planner_generated` mode (once for the plan, once for synthesis) and once in `sequential` mode (synthesis only). Credits are deducted for each call. When `approvedPlan` is provided, the planning call is skipped and only synthesis is charged.

---

## 3. Database schema

File: `db/schema/agent-teams.ts`

### `agent_team`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | nanoid |
| `userId` | text FK → user | cascade delete |
| `name` | text | display name |
| `description` | text | optional |
| `routingStrategy` | text | `'sequential'` \| `'planner_generated'` |
| `config` | jsonb `AgentTeamConfig` | see type below |
| `brandId` | text FK → brand | optional |
| `isPublic` | boolean | reserved for sharing |
| `createdAt` / `updatedAt` | timestamp | |

```typescript
export type AgentTeamConfig = {
  maxSteps?: number;           // default 5 — caps specialist step count
  budgetCredits?: number;      // abort run if cumulative spend would exceed this
  outputFormat?: 'markdown' | 'json';   // legacy — prefer outputContract
  outputContract?: 'markdown' | 'json' | 'sections';  // controls synthesis + rendering
  contractSections?: string[]; // section names for outputContract='sections'
};
```

`config` is a `jsonb` column — adding new fields requires only a TypeScript type change, no migration.

### `agent_team_member`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `teamId` | text FK → agent_team | cascade delete |
| `agentId` | text FK → agent | cascade delete |
| `role` | text | `'orchestrator'` \| `'specialist'` |
| `displayRole` | text | human label shown in UI (e.g. "Research Lead") |
| `position` | integer | execution order for sequential routing |
| `tags` | text[] | drives artifact type inference |
| `handoffInstructions` | text | injected into specialist sub-prompt |
| `createdAt` | timestamp | |

**Constraints:**
- `UNIQUE(teamId, agentId)` — an agent can only be a member once per team
- Only one `role = 'orchestrator'` allowed per team (enforced at API level)

### `team_run`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `teamId` | text FK → agent_team | cascade delete |
| `userId` | text FK → user | cascade delete |
| `threadId` | text FK → chat_thread | nullable, set null on thread delete |
| `status` | text | `'running'` \| `'completed'` \| `'failed'` |
| `inputPrompt` | text | original user prompt |
| `finalOutput` | text | synthesised answer |
| `budgetCredits` | integer | snapshot of config.budgetCredits at run time |
| `spentCredits` | integer | running total, updated after each step |
| `errorMessage` | text | set on failure |
| `createdAt` / `completedAt` | timestamp | |

### `team_run_step`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `runId` | text FK → team_run | cascade delete |
| `memberId` | text FK → agent_team_member | set null if member deleted |
| `agentId` | text | snapshot (preserved even if member deleted) |
| `agentName` | text | snapshot |
| `role` | text | `'orchestrator'` \| `'specialist'` |
| `stepIndex` | integer | 0-based; planning step = 0 in planner mode |
| `inputPrompt` | text | the actual prompt sent to the model |
| `output` | text | raw model output |
| `summary` | text | ≤400 char truncation for context injection |
| `artifactType` | text | see ArtifactType below |
| `modelId` | text | model used |
| `promptTokens` / `completionTokens` | integer | |
| `creditCost` | integer | credits deducted for this step |
| `status` | text | `'running'` \| `'completed'` \| `'failed'` |
| `errorMessage` | text | |
| `startedAt` / `completedAt` | timestamp | |

**ArtifactType values:** `research_brief | ad_copy | analysis | creative_direction | strategy | content | other`

---

## 4. Server engine

All server logic lives in `features/agent-teams/server/`.

### 4.1 `queries.ts`

Pure DB helpers — no business logic. Each function maps 1:1 to a DB operation.

```typescript
getTeamWithMembers(teamId, userId)           // team + ordered members + agent rows
getUserTeams(userId)                         // flat list, no members
listTeamRuns(teamId, userId, limit=20)       // newest-first, no steps
getTeamRunWithSteps(runId, userId)           // run + steps ordered by stepIndex
createTeamRun(params)                        // inserts with status='running'
updateTeamRun(runId, patch)                  // partial update
createTeamRunStep(params)                    // inserts with status='running'
updateTeamRunStep(stepId, patch)             // partial update
```

### 4.2 `orchestrator.ts`

Stateless utilities called by `run-engine.ts`.

#### `resolveAgentModel(agentModelId)`
Falls back to `chatModel` (from `lib/ai.ts`) if the agent's model is unset or removed from `availableModels`. Prevents silent breakage when models are deprecated.

#### `buildContextBlock(priorSteps)`
Builds an XML `<team_context>` block from prior step summaries. Injected into each specialist's prompt so they know what earlier agents produced. **Uses summaries, not full outputs** to keep context windows small.

#### `buildSpecialistPrompt({ userPrompt, member, priorSteps })`
Used by sequential routing. Combines:
1. `<team_context>` from prior steps
2. `<handoff_instructions>` from `member.handoffInstructions`
3. The original `userPrompt`

#### `generateStepSummary(output, maxChars=400)`
Sentence-boundary truncation. Fast, zero cost. Returns the first ≤400 chars ending at a sentence boundary.

#### `inferArtifactType(member)`
Keyword match against `member.tags`, `member.displayRole`, `member.agent.name`. Returns one of the 7 `ArtifactType` values. Used when the planner hasn't specified an artifact type (sequential mode).

```typescript
const TAG_MAP: [string[], ArtifactType][] = [
  [['research', 'data', 'analysis', ...], 'research_brief'],
  [['copy', 'ad', 'headline', ...],       'ad_copy'],
  // etc.
];
```
To change how artifact types are inferred, edit `TAG_MAP`.

#### `buildContractHint(outputContract?, contractSections?, outputFormat?)`
Private helper. Produces the format instruction appended to the synthesis prompt:
- `'json'` → instructs the model to output a single valid JSON object
- `'sections'` → injects `## Section1\n## Section2...` structure using `contractSections` (defaults: Summary, Key Findings, Recommendations)
- `'markdown'` / undefined → existing markdown instruction (backwards compatible with `outputFormat`)

#### `synthesizeWithOrchestrator({ orchestratorMember, userPrompt, steps, outputFormat?, outputContract?, contractSections?, synthesisInstruction? })`
Final synthesis call. The orchestrator receives all **full** step outputs (not summaries) so it can write a high-quality deliverable. `synthesisInstruction` from the planner overrides the default prompt closing. `outputContract` and `contractSections` are injected via `buildContractHint`.

#### `generatePlan({ orchestratorMember, userPrompt, specialists })`
**Planner-generated routing only.** Calls the orchestrator model with a structured prompt asking it to produce a JSON `OrchestratorPlan`. Returns `wasFallback: boolean` — `true` when JSON parsing failed and the plan was defaulted to sequential-all-specialists.

Handles:
- Stripping markdown fences from output
- JSON.parse failure → `wasFallback = true`, falls back to sequential-all-specialists
- Unknown `memberId` sanitisation
- Empty step list → forces at least one step

```typescript
type OrchestratorPlan = {
  steps: PlannerStep[];
  synthesisInstruction: string;
};
type PlannerStep = {
  memberId: string;
  subPrompt: string;
  artifactType: ArtifactType;
  usesPreviousSteps: string[];
  reasoning?: string;
};
```

### 4.3 `run-engine.ts`

The main execution function. Entry point: `executeTeamRun(params)`.

#### `ExecuteTeamRunParams`

```typescript
type ExecuteTeamRunParams = {
  team: AgentTeamWithMembers;
  userId: string;
  userPrompt: string;
  threadId?: string | null;
  onUpdate: (update: TeamRunStatusUpdate) => void;
  approvedPlan?: OrchestratorPlan;   // skip planning call if plan was pre-approved via /plan endpoint
};
```

#### Execution flow

```
executeTeamRun()
  1. splitMembers() → orchestrator + specialists[]
  2. Credit pre-check: getUserBalance >= estimateRunCost
  3. createTeamRun (status='running')
  4a. [planner_generated]
      createTeamRunStep(role='orchestrator', stepIndex=0)
      if approvedPlan:
        use provided plan directly — no LLM call, no credit deduction for planning
        updateTeamRunStep (status='completed', summary='Using pre-approved plan')
      else:
        generatePlan() → OrchestratorPlan + wasFallback
        deductCredits for planning
        updateTeamRunStep (status='completed')
      resolvedSteps = plan.steps mapped to member objects
  4b. [sequential]
      resolvedSteps = all specialists in position order
  5. for each resolvedStep:
      budget guard → throw TeamRunError('budget_exceeded') if exceeded
      createTeamRunStep (status='running')
      onUpdate({ type: 'step_start' })
      buildToolSet(member.agent.enabledTools) → specialistTools (empty if model doesn't support tools)
      generateText(system, prompt, tools?, maxSteps:5?)
      deductCredits
      updateTeamRunStep (status='completed'|'failed')
      updateTeamRun (spentCredits)
      onUpdate({ type: 'step_complete' })
      accumulate priorStepContexts (summaries) + synthesisSteps (full)
  6. Synthesis:
      createTeamRunStep(role='orchestrator')
      synthesizeWithOrchestrator(outputContract, contractSections)
      deductCredits
      updateTeamRunStep
  7. updateTeamRun (status='completed', finalOutput, spentCredits)
     onUpdate({ type: 'run_complete' })
  catch:
     updateTeamRun (status='failed')
     onUpdate({ type: 'run_error' })
     rethrow
```

#### Specialist tool use

Before each specialist's `generateText` call:

```typescript
const specialistTools: ToolSet = (() => {
  if (toolDisabledModels.has(modelId)) return {};          // model doesn't support tools
  const enabledIds = member.agent.enabledTools;
  if (!enabledIds || enabledIds.length === 0) return {};   // agent has no tools configured
  return buildToolSet({ enabledToolIds: enabledIds, userId, source: 'agent' });
})();

await generateText({
  model, system, prompt,
  ...(hasTools && { tools: specialistTools, maxSteps: 5 }),
});
```

`toolDisabledModels` is imported from `features/chat/server/routing.ts` — the same set used by the main chat route. Any model added to that set is automatically excluded from tool use in team runs too.

#### `estimateRunCost(team)`
Sums `getCreditCost(resolveAgentModel(member.agent.modelId))` for all members. Used for the pre-check before the stream opens and surfaced in the 402 error response.

#### `TeamRunError`
Custom error class with a `code` field:

| Code | When |
|------|------|
| `insufficient_credits` | Balance < estimated cost |
| `budget_exceeded` | Step would push spend over `config.budgetCredits` |
| `unknown` | All other cases |

`TeamRunError` is caught at the route level and surfaces a clean error message to the client. Non-`TeamRunError` exceptions mark the run as failed and emit `run_error`.

---

## 5. API routes

All routes require authentication via `auth.api.getSession`.

### Team CRUD

| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| `GET` | `/api/agent-teams` | — | `{ teams: TeamWithMembers[] }` |
| `POST` | `/api/agent-teams` | `CreateAgentTeamInput` | `{ team: AgentTeamRow }` |
| `GET` | `/api/agent-teams/[teamId]` | — | `{ team: TeamWithMembers }` |
| `PUT` | `/api/agent-teams/[teamId]` | `UpdateAgentTeamInput` | `{ team: AgentTeamRow }` |
| `DELETE` | `/api/agent-teams/[teamId]` | — | `{ success: true }` |

`AgentTeamConfig` accepted in `PUT`:
```typescript
{
  maxSteps?: number;
  budgetCredits?: number;
  outputFormat?: 'markdown' | 'json';
  outputContract?: 'markdown' | 'json' | 'sections';
  contractSections?: string[];
}
```

### Member CRUD

| Method | Route | Body | Response |
|--------|-------|------|----------|
| `POST` | `/api/agent-teams/[teamId]/members` | `AddTeamMemberInput` | `{ member }` 201 |
| `PUT` | `/api/agent-teams/[teamId]/members/[memberId]` | `UpdateTeamMemberInput` | `{ member }` |
| `DELETE` | `/api/agent-teams/[teamId]/members/[memberId]` | — | `{ success: true }` |

### Plan preview

**`POST /api/team-chat/plan`** — generates the orchestrator plan with no credit deduction and no specialist execution.

```typescript
// Request
{ teamId: string; userPrompt: string }

// Response — PlanPreviewResponse
{
  steps: Array<{
    memberId: string;
    memberName: string;
    displayRole: string | null;
    subPrompt: string;
    artifactType: ArtifactType;
    reasoning?: string;
  }>;
  synthesisInstruction: string;
  fallback: boolean;   // true = JSON parse failed, sequential fallback applied
}

// Errors
401 / 400 / 404 / 422 (team not found, not planner strategy, no orchestrator, no specialists)
500 Failed to generate plan
```

`maxDuration = 30`. Only callable for `planner_generated` teams.

### Run streaming

**`POST /api/team-chat`**

```typescript
// Request
{
  teamId: string;
  userPrompt: string;
  threadId?: string | null;
  approvedPlan?: {                   // optional — from plan preview flow
    steps: Array<{ memberId: string; subPrompt: string; artifactType: string }>;
    synthesisInstruction: string;
  };
}

// Sync errors (before stream opens)
401 Unauthorized
400 Invalid body
404 Team not found / Thread not found
422 No members / No orchestrator
402 Insufficient credits { error, estimatedCost, balance }

// Stream (Vercel AI UIMessageStream)
{ type: 'message-metadata', messageMetadata: { teamUpdates: TeamRunStatusUpdate[] } }
{ type: 'text-start', id }
{ type: 'text-delta', delta, id }
{ type: 'text-end', id }
{ type: 'error', errorText }
```

`maxDuration = 120` (covers specialist calls with tool use round-trips; requires Vercel Pro — revert to 60 on Hobby plan).

### Run history

| Method | Route | Query | Response |
|--------|-------|-------|----------|
| `GET` | `/api/team-runs?teamId=X` | `teamId` required | `{ runs: TeamRunRow[] }` |
| `GET` | `/api/team-runs?teamId=X&runId=Y` | both required | `{ run: TeamRunWithSteps }` |

---

## 6. Frontend

### 6.1 Hooks

All hooks live in `features/agent-teams/hooks/`.

#### `useTeams()` / `useTeam(teamId)`
TanStack Query wrappers. Query key: `['agent-teams']` / `['agent-teams', id]`.

#### `useCreateTeam()` / `useUpdateTeam()` / `useDeleteTeam()`
Mutations. All invalidate `['agent-teams']` on success.

#### `useAddTeamMember(teamId)` / `useUpdateTeamMember(teamId)` / `useRemoveTeamMember(teamId)`
Mutations. Invalidate both `['agent-teams']` and `['agent-teams', teamId]`.

#### `useTeamChat(teamId, routingStrategy, threadId?)`

Streaming hook with a two-phase state machine for planner teams.

```typescript
const {
  status,             // 'idle' | 'running' | 'awaiting_approval' | 'done' | 'error'
  teamUpdates,        // TeamRunStatusUpdate[] — drives activity feed
  output,             // string — final synthesised text
  error,
  planSteps,          // PlanPreviewStep[] — non-empty during awaiting_approval
  synthesisInstruction,
  planFallback,       // true = planner fell back to sequential
  editedSubPrompts,   // Record<memberId, string> — user edits to sub-prompts
  setEditedSubPrompt, // (memberId, value) => void
  fetchPlan,          // (userPrompt) => Promise<void> — for planner teams
  approvePlan,        // () => Promise<void> — executes with edited plan
  run,                // (userPrompt, approvedPlan?) => Promise<void>
  reset,
} = useTeamChat(teamId, routingStrategy, threadId);
```

**Flow for planner teams:**
1. User submits prompt → `fetchPlan(prompt)` → calls `POST /api/team-chat/plan`
2. Status enters `'awaiting_approval'` — `planSteps` + `synthesisInstruction` are populated
3. User reviews/edits sub-prompts via `setEditedSubPrompt`
4. User clicks "Run with this plan" → `approvePlan()` → builds `OrchestratorPlan` from edited steps → calls `run(prompt, approvedPlan)`
5. Status enters `'running'` → stream starts → `'done'`

**Flow for sequential teams:** Call `run(prompt)` directly — no plan preview.

On `status === 'done'`, invalidates `['team-runs', teamId]` so the History tab refreshes.

#### `useTeamRuns(teamId)` / `useTeamRun(runId, teamId)`
Query keys: `['team-runs', teamId]` / `['team-run', runId]`. `useTeamRun` is lazy — only fetches when `runId` is non-null.

#### `useThreadList()`
Reads from the shared `['threads']` cache key. No duplicate request if the sidebar has already loaded threads.

### 6.2 Components

All components live in `features/agent-teams/components/`.

| Component | Key props | Purpose |
|-----------|-----------|---------|
| `TeamsList` | — | Root page component. Manages selected team + view (`run`\|`history`\|`build`) |
| `TeamBuilderPanel` | `team, onDeleted?, pendingSlots?` | Config form + member list. Renders template slots when `pendingSlots` is provided |
| `TeamMemberRow` | `member, isFirst, isLast, callbacks…` | Member card with inline display-role editing |
| `AgentPickerDialog` | `open, onOpenChange, excludedAgentIds, onSelect, initialRole?` | Searchable agent picker. `initialRole` pre-selects a role (used by template slots) |
| `TemplatePickerDialog` | `open, onOpenChange, onSelect` | Card grid of 4 built-in team blueprints |
| `TeamChatInterface` | `teamId, teamName, routingStrategy?, outputContract?, contractSections?, threadId?` | Full run surface: plan preview panel (planner), activity feed, output, prompt input |
| `TeamActivityFeed` | `updates, status` | Live step progress. Running steps pulse; completed steps expand |
| `AgentStepCard` | `step, stepNumber` | Collapsible card for one completed specialist step |
| `ContractOutputRenderer` | `output, outputContract?, contractSections?` | Renders final output as prose, JSON `<pre>`, or named section cards |
| `TeamRunHistory` | `teamId` | Past runs list. Expanding a row lazy-loads steps |

#### `TeamsList` view management

```
selectedTeam = null  → shows team grid + "New team" + "From template" buttons
selectedTeam != null → shows detail with tabs:
  view='chat'    → TeamChatInterface (routingStrategy, outputContract, contractSections passed in)
  view='history' → TeamRunHistory
  view='build'   → TeamBuilderPanel (pendingSlots passed if created from template)
```

#### `TeamBuilderPanel` pending slots

When a team is created from a template, `TeamsList` passes `pendingSlots: TeamMemberSlot[]` to the builder. Pending slots are stored in local state. Each slot renders as a dashed row with an "Assign agent" button. When an agent is assigned, `addMember.mutate(...)` is called with the slot's `displayRole`, `role`, `tags`, and `position`. The slot is removed from local state on success.

`TeamMemberSlot`:
```typescript
type TeamMemberSlot = {
  displayRole: string;
  role: TeamMemberRole;
  tags: string[];
  position: number;
  slotHint: string;  // shown in the UI e.g. "Agent with web-search tools enabled"
};
```

#### `TeamBuilderPanel` config fields

| UI field | Maps to | Default |
|----------|---------|---------|
| Team name | `agentTeam.name` | required |
| Description | `agentTeam.description` | optional |
| Credit budget | `config.budgetCredits` | unlimited |
| Max specialist steps | `config.maxSteps` | 5 |
| Output contract | `config.outputContract` | `'markdown'` |
| Contract sections | `config.contractSections` | Summary, Key Findings, Recommendations |
| Routing strategy | `agentTeam.routingStrategy` | `'sequential'` |

All fields are sent together on Save via `PUT /api/agent-teams/[teamId]`.

#### `ContractOutputRenderer` rendering logic

| `outputContract` | Render |
|-----------------|--------|
| `'json'` | `JSON.parse(output)` → `<pre>` block; fallback to prose on parse error |
| `'sections'` | Split on `\n## ` headings → numbered section cards; ordered by `contractSections`; fallback to prose if no headings found |
| `'markdown'` / undefined | `prose prose-sm` div with `whitespace-pre-wrap` |

---

## 7. Streaming protocol

The run uses Vercel AI SDK's `UIMessageStream` format.

```
Server writes (createUIMessageStream)         Client reads (readUIMessageStream)
─────────────────────────────────────         ──────────────────────────────────
message-metadata { teamUpdates[] }    →  message.metadata.teamUpdates
  (written after every step update)       setTeamUpdates([...])

text-start { id }                     →  (ignored)
text-delta { delta, id }              →  message.parts[type='text'].text
text-end { id }                       →  (ignored)    setOutput(text)

error { errorText }                   →  throw new Error(errorText)
```

`TeamRunStatusUpdate` union:
```typescript
type TeamRunStatusUpdate =
  | { type: 'step_start';    runId; stepIndex; memberId; agentId; agentName; displayRole }
  | { type: 'step_complete'; runId; stepIndex; memberId; agentId; agentName; displayRole; summary; artifactType }
  | { type: 'run_complete';  runId }
  | { type: 'run_error';     runId; error }
```

The metadata array is **cumulative** — each write replaces the previous with the full updated array. The client sets state with `setTeamUpdates([...meta.teamUpdates])`, overwriting on every chunk.

---

## 8. Credit system integration

Uses `lib/credits.ts` functions. All costs flow through `getCreditCost(modelId)`.

### When credits are deducted

| Step | Who pays | When |
|------|----------|------|
| Specialist call | `userId` | After `generateText` succeeds |
| Planning call | `userId` | After `generatePlan` succeeds — **skipped when `approvedPlan` provided** |
| Synthesis call | `userId` | After `synthesizeWithOrchestrator` succeeds |

Credits are **not** deducted if the model call throws (step error case). Credits are deducted per call, not per token.

### Plan preview is free

`POST /api/team-chat/plan` calls `generatePlan()` but never calls `deductCredits`. The planning LLM call is charged only inside `executeTeamRun` (i.e. when the run is actually executed). If the user cancels after previewing, no credits are spent.

### Budget guard

Checked before each specialist step:
```typescript
if (config.budgetCredits != null && totalSpent + creditCost > config.budgetCredits) {
  throw new TeamRunError('budget_exceeded');
}
```

The budget check also runs before the planning step in `planner_generated` mode.

### Route-level pre-check

`POST /api/team-chat` checks balance before opening the stream:
```typescript
if (balance < estimateRunCost(team)) → 402
```

`estimateRunCost` sums the cost of all members. This is an over-estimate for `planner_generated` (not all specialists may run) but guarantees the stream won't open for users who definitely can't afford it.

---

## 9. Thread integration

When `threadId` is supplied to `POST /api/team-chat` and the run completes successfully, two messages are appended to the thread:

```typescript
// user message
{ role: 'user',      parts: [{ type: 'text', text: userPrompt }],    metadata: null }

// assistant message
{ role: 'assistant', parts: [{ type: 'text', text: finalOutput }],
  metadata: { teamRun: { runId, teamId, teamName, stepCount } } }
```

Messages are inserted at `MAX(position) + 1` and `MAX(position) + 2` to avoid collisions with existing messages.

### Persistence durability

`persistChatResult` (called by the regular chat API on each chat turn) deletes and re-inserts all messages for a thread. Team run messages are preserved using the same mechanism as compare messages:

```typescript
// features/chat/server/persistence.ts
const compareRows = existingRows.filter((row) => {
  const meta = row.metadata as { compareGroupId?: string; teamRun?: unknown } | null;
  return !!meta?.compareGroupId || !!meta?.teamRun;  // ← team run messages preserved
});
```

Any message with `metadata.teamRun` survives the next regular chat turn.

### "Open in chat" navigation

`TeamChatInterface` uses `setPendingThread(threadId)` from `features/chat/hooks/use-threads.ts` (module-level variable) before navigating to `/`. This tells `useThreads` on the chat page to activate that thread on mount.

---

## 10. Adding or changing things

### Add a new ArtifactType

1. Add the value to the union in `features/agent-teams/types.ts`
2. Add a label in `ARTIFACT_LABELS` in `agent-step-card.tsx`
3. Add a color class in `ARTIFACT_COLORS` in `agent-step-card.tsx`
4. Optionally add keyword triggers to `TAG_MAP` in `orchestrator.ts`

### Add a new routing strategy

1. Extend the union in `db/schema/agent-teams.ts` → `routingStrategy`
2. Add a `SELECT` option in `TeamBuilderPanel`
3. Add a branch in `run-engine.ts` → `executeTeamRun()` after the existing `if (isPlanner)` block
4. Add to the `updateSchema` enum in `app/api/agent-teams/[teamId]/route.ts`
5. Handle the new strategy in `useTeamChat` (does it need plan preview? update the `fetchPlan` condition)

### Add a new `AgentTeamConfig` field

1. Add the field to `AgentTeamConfig` type in `db/schema/agent-teams.ts` — no migration needed (jsonb)
2. Add Zod validation in `app/api/agent-teams/[teamId]/route.ts` → `updateSchema.config`
3. Add state + UI in `TeamBuilderPanel` (wire into `isDirty` and `buildConfig()`)
4. Read the field in `run-engine.ts` → `const config = team.config ?? {}`

### Add a team template

1. Add an entry to `TEAM_TEMPLATES` in `features/agent-teams/templates.ts`
2. No other changes needed — `TemplatePickerDialog` renders `TEAM_TEMPLATES` directly

### Change the output contract rendering

Edit `ContractOutputRenderer` in `features/agent-teams/components/contract-output-renderer.tsx`. The three rendering branches are clearly separated (`JsonOutput`, `SectionsOutput`, prose fallback). To add a new contract type (e.g. `'table'`):
1. Add the value to `AgentTeamConfig['outputContract']` union in `db/schema/agent-teams.ts`
2. Add a branch in `ContractOutputRenderer`
3. Add a `buildContractHint` case in `orchestrator.ts` to instruct the synthesis model

### Change the synthesis prompt

Edit `synthesizeWithOrchestrator()` in `orchestrator.ts`. The `synthesisInstruction` parameter (from planner mode) always appends after the specialist block — keep that injection point intact. The `buildContractHint` result appends at the very end — keep it last.

### Change the planning prompt

Edit `generatePlan()` in `orchestrator.ts`. The JSON schema description in the prompt must stay aligned with the `OrchestratorPlan` / `PlannerStep` types. If you add fields to `PlannerStep`, update both the prompt and the type.

### Add a member config field (e.g. temperature)

1. Add column to `agent_team_member` in `db/schema/agent-teams.ts`
2. Generate and apply migration: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
3. Add to `addMemberSchema` / `updateMemberSchema` in the member API routes
4. Add UI in `TeamMemberRow`
5. Use in `run-engine.ts` → specialist `generateText` call

---

## 11. Known limitations

### Sequential steps only at runtime
Even in `planner_generated` mode, steps run sequentially (one at a time). Independent steps could theoretically run in parallel with `Promise.all`, but this is not implemented. See §12.2.

### Tool latency with maxDuration
Specialist tool use is enabled but increases latency significantly. With `maxSteps: 5` tool rounds per specialist and 3–5 specialists, total run time can approach `maxDuration = 120s`. For long teams with tool-heavy specialists, consider reducing `maxSteps` in the specialist tool call or increasing `maxDuration` if your Vercel plan allows.

### Plan preview is planner-only
The two-phase `fetchPlan` → `approvePlan` flow only activates when `routingStrategy === 'planner_generated'`. Sequential teams run immediately. There is no way to preview what sub-prompts a sequential run will generate (they are built dynamically from accumulated context during execution).

### Thread message durability window
Team run messages are preserved by `persistChatResult` only if the chat session was started **after** the team run completed. If a user runs a team while the chat thread is already open in another tab, the next regular chat turn from that tab will replace messages (the in-memory `useChat` state doesn't include the team run messages).

### Budget is an over-estimate
`estimateRunCost` counts all members. In `planner_generated` mode the planner may only select a subset, so the actual cost is often lower than the estimate used for the pre-check.

### Template slots use local state
`pendingSlots` in `TeamBuilderPanel` is stored in component state, not in the database. If the user navigates away from the builder tab before filling all slots, the unfilled slots disappear. Partially filled teams will have some members in the DB; the remaining slots are lost.

---

## 12. Future extensions

Each entry below includes the files that would need changing and design notes.

---

### 12.1 Handoff instructions editor

**What:** `agentTeamMember.handoffInstructions` stores per-member instructions injected into specialist prompts, but the UI has no way to set them.

**Files to change:**
- `features/agent-teams/components/team-member-row.tsx` — add an expandable section with a `<Textarea>` for `handoffInstructions`
- `features/agent-teams/hooks/use-teams.ts` — `useUpdateTeamMember` already supports `handoffInstructions`

**Design note:** Keep it collapsed by default. An empty string should be treated as `null` before mutation.

---

### 12.2 Parallel step execution

**What:** Independent steps (where `usesPreviousSteps` is empty) could run concurrently, reducing total run time.

**Files to change:**
- `features/agent-teams/server/run-engine.ts` — group `resolvedSteps` into waves; run each wave with `Promise.all`
- Context injection needs care: steps within the same wave cannot see each other's output

**Design note:** Only applicable to `planner_generated` mode. The `PlannerStep.usesPreviousSteps` field was designed for this.

```typescript
function buildWaves(steps: PlannerStep[]): PlannerStep[][] {
  const waves: PlannerStep[][] = [];
  const completed = new Set<string>();
  let remaining = [...steps];
  while (remaining.length > 0) {
    const wave = remaining.filter(s => s.usesPreviousSteps.every(id => completed.has(id)));
    wave.forEach(s => completed.add(s.memberId));
    waves.push(wave);
    remaining = remaining.filter(s => !completed.has(s.memberId));
  }
  return waves;
}
```

---

### 12.3 Streaming specialist output

**What:** Each specialist call uses `generateText` which buffers the full response. Switching to `streamText` would let users see each step's output appearing word-by-word.

**Files to change:**
- `features/agent-teams/server/run-engine.ts` — replace `generateText` with `streamText`; emit `step_delta` updates
- `features/agent-teams/types.ts` — add `{ type: 'step_delta'; stepIndex; delta }` to `TeamRunStatusUpdate`
- `features/agent-teams/components/team-activity-feed.tsx` — render in-progress step output as it streams

**Design note:** Start with just the orchestrator synthesis step (single change in `synthesizeWithOrchestrator`) before streaming all specialists.

---

### 12.4 Public team sharing

**What:** `agentTeam.isPublic` exists but there's no share URL, no public access API, and no copy-team flow.

**Files to create:**
- `app/api/agent-teams/[teamId]/share/route.ts`
- `app/(public)/teams/[teamId]/page.tsx` — read-only public view with "Copy to my teams"

**Design note:** Follow the existing agent share pattern in `features/agents/`.

---

### 12.5 Team run triggered from chat

**What:** A `/team` slash-command or a composer button in the chat UI could trigger a run in-context.

**Files to change:**
- `features/chat/components/composer/chat-composer.tsx` — add a Teams button
- New `features/agent-teams/components/team-run-dialog.tsx` — floating dialog using `useTeamChat` with the current `activeThreadId`

**Design note:** Thread integration (§9) already handles saving messages back — the output will appear in chat history automatically.

---

### 12.6 Run cost estimate in UI

**What:** Show the user how many credits the run will cost before submitting.

**Files to change:**
- `app/api/agent-teams/[teamId]/estimate/route.ts` (new) — `GET` returning `estimateRunCost(team)`
- `features/agent-teams/hooks/use-team-runs.ts` — add `useRunEstimate(teamId)`
- `features/agent-teams/components/team-chat-interface.tsx` — estimate badge near submit button

**Design note:** `estimateRunCost` is server-only. Never call it from the client directly — always go through a route.

---

### 12.7 Step retry

**What:** If a specialist step fails, offer a "Retry this step" button in the history view.

**Files to create:**
- `app/api/team-runs/[runId]/retry-step/route.ts` — re-runs a single failed step

**Files to change:**
- `features/agent-teams/components/team-run-history.tsx` — add retry button on `step.status === 'failed'`

**Design note:** Retry needs to reconstruct `priorStepContexts` from successfully completed steps before the failed one.

---

### 12.8 Async / background runs

**What:** Long teams with tool-enabled specialists can approach `maxDuration`. Moving execution to a background job removes the 120s ceiling.

**Architecture:**
- Replace `executeTeamRun` call in `/api/team-chat` with a job enqueue (e.g. Inngest / QStash / pg-boss)
- Route returns a `runId` immediately; client polls `/api/team-runs?runId=X` for status
- Remove streaming — replace activity feed with a polling-based `useTeamRun` refresh

**Design note:** This is a significant architecture change. The streaming protocol (§7) would be replaced by a polling or WebSocket model. Do not attempt this as an incremental change — redesign the frontend hook and API route together.

---

### 12.9 Evaluation suite

**What:** Save test prompts + expected outcomes per team. Re-run all evals after changing team config to detect regressions.

**New tables needed:**
- `teamEvalCase` — saved prompt, expected traits, rubric
- `teamEvalRun` — run of all eval cases for a team version

**Files to create:**
- `features/agent-teams/components/team-eval-panel.tsx`
- `app/api/agent-teams/[teamId]/evals/route.ts`

**Design note:** Each eval re-uses `executeTeamRun` — it's just a run with a known expected output. The scoring is human-reviewed or rubric-based (1–5 per dimension). Start with "save as eval case" from a real run, then build the re-run flow.

---

*End of document.*
