# Workspace AI Assist Implementation Guide

## Purpose

This document defines the recommended architecture for small, focused AI helpers inside Vaja's product surfaces.

Examples:

- generate an agent cover image
- rewrite a skill description
- write an agent description
- suggest conversation starters
- improve a LINE OA channel summary
- draft a campaign title or short summary

It is meant to guide both AI-assisted implementation and future developer work.

## Current Progress

Implemented now:

- `features/workspace-ai/` backend foundation
- `POST /api/workspace-ai/text`
- `POST /api/workspace-ai/image`
- agent editor integration for:
  - `agent-description`
  - `agent-starters`
  - `agent-cover`
- backend support for `skill-description` prompt generation

Not implemented yet:

- skill editor UI integration
- reusable shared workspace AI UI primitives
- dedicated audit or analytics persistence

---

## Problem Statement

Vaja already has a strong AI chat runtime in `app/api/chat/route.ts`.

That runtime is designed for conversational work:

- thread history
- prompt assembly
- memory injection
- skill activation
- tool routing
- follow-up suggestions
- message persistence
- long-running conversation behavior

Small editing assists inside forms are a different product job.

They are usually:

- one-shot
- field-scoped
- low-latency
- low-cost
- draft-oriented
- not part of a conversation transcript

Trying to force these actions through the main chat pipeline creates unnecessary complexity, slower responses, and blurred product boundaries.

---

## Decision

Workspace AI assist should be a separate runtime from normal chat.

It should share lower-level infrastructure where useful:

- auth
- model registry in `lib/ai.ts`
- credits helpers in `lib/credits.ts`
- prompt enhancement patterns
- image generation services
- upload and storage utilities

But it should not call or depend on the full chat orchestration path in `app/api/chat/route.ts`.

Important rule:

- Do not route editor assists through `app/api/chat/route.ts`.
- Do not persist editor assists as chat messages.
- Do not activate agent skills, thread memory, or follow-up suggestions for narrow editor actions unless a specific assist explicitly requires them.

---

## What Counts As Workspace AI Assist

Workspace AI assist is any AI action initiated from a product editor, settings panel, or structured creation flow where the output is meant to fill or refine a field rather than continue a conversation.

Examples that belong here:

- `Write with AI` for `description`
- `Rewrite` for a skill summary
- `Generate cover image` for an agent
- `Suggest 4 starters` for agent onboarding chips
- `Improve title` for a campaign brief

Examples that do not belong here:

- open-ended user chat
- agent-to-user conversation
- multi-turn content strategy discussion
- chat-based brainstorming with follow-up questions
- tool-using autonomous task execution inside the main assistant

Rule of thumb:

- If the user is filling a field, use workspace AI assist.
- If the user is having a conversation, use chat.

---

## Current Repo Patterns To Reuse

The repo already has multiple useful precedents:

### Narrow text transformation

`lib/prompt-enhance.ts`

This is already a focused non-chat AI utility:

- small input
- narrow output contract
- no thread persistence
- no skills or tool routing

### Focused non-chat generation route

`app/api/compare/route.ts`

This shows that Vaja already supports specialized AI routes outside the main chat flow.

### Async media generation

- `app/api/image/route.ts`
- `features/image/service.ts`
- `app/api/generate/status/route.ts`
- `app/api/generate/persist/route.ts`
- `db/schema/tools.ts`

This is the right pattern for image generation because cover image generation is not a synchronous text completion problem.

### Standard image upload

- `app/api/agents/image/route.ts`
- `components/ui/image-upload-zone.tsx`
- `docs/media-upload-guide.md`

Generated cover images should land in the same image/storage world as uploaded cover images.

---

## Target Architecture

Use a dedicated feature module:

```text
features/workspace-ai/
  schema.ts          <- Zod request/response contracts
  types.ts           <- shared TS types
  prompts.ts         <- field-specific prompt builders and output instructions
  service.ts         <- canonical business logic
  models.ts          <- optional assist-specific model selection helpers
  audit.ts           <- optional analytics/audit helpers

app/api/workspace-ai/
  text/route.ts      <- synchronous field assists
  image/route.ts     <- async cover-generation trigger
```

Optional future UI helpers:

```text
features/workspace-ai/components/
  ai-write-button.tsx
  ai-image-button.tsx
  ai-suggestion-sheet.tsx
```

---

## Core Principle: One Canonical Service Per Assist Runtime

Like tools, workspace AI assist should have one canonical `service.ts`.

Routes and UI should not duplicate prompt logic.

```text
Editor UI
  -> POST /api/workspace-ai/text
  -> features/workspace-ai/service.ts

Editor UI
  -> POST /api/workspace-ai/image
  -> features/workspace-ai/service.ts
  -> features/image/service.ts
```

Important rule:

- Prompt construction belongs in `features/workspace-ai/`.
- Form components should only collect context and render results.
- API routes should do auth, validation, and thin orchestration only.

---

## Runtime Split

There should be two runtime classes.

## 1. Text Assist Runtime

Use this for:

- descriptions
- summaries
- rewrite actions
- starter prompts
- title suggestions
- short structured field outputs

Characteristics:

- synchronous
- stateless
- no `chatThread`
- no `chatMessage`
- no skill auto-activation
- no memory injection by default
- returns draft candidates only

Recommended contract:

```ts
type WorkspaceTextAssistKind =
  | 'agent-description'
  | 'agent-starters'
  | 'skill-description'
  | 'skill-prompt-fragment-rewrite'
  | 'line-oa-description'
  | 'campaign-title'
  | 'campaign-summary';
```

## 2. Image Assist Runtime

Use this for:

- generate agent cover image
- generate skill cover image
- generate LINE OA or content cover variants

Characteristics:

- async
- task-based
- backed by `toolRun`
- uses polling and persistence path already used by generation features

Important rule:

- Do not invent a second async generation system for workspace cover images.
- Reuse the existing image-generation stack.

---

## Why This Should Stay Separate From Chat

The main chat route currently does all of these things:

- resolves a thread
- loads user preferences
- loads agent and brand context
- fetches and injects memory
- resolves skill runtime
- routes models by intent
- builds tools
- assembles a full system prompt
- persists messages and follow-up suggestions

That is correct for chat and incorrect for a one-button field helper.

For a field helper, the system should instead:

1. authenticate user
2. validate narrow input
3. build a small task-specific prompt
4. call a fast model
5. return draft output

Benefits:

- faster UX
- lower credit cost
- simpler prompts
- clearer testing
- easier safety controls
- easier future maintenance

---

## Request Model

Text assists should accept structured editor context rather than free-form conversation history.

Recommended request shape:

```ts
const workspaceTextAssistRequestSchema = z.object({
  kind: z.enum([
    'agent-description',
    'agent-starters',
    'skill-description',
    'skill-prompt-fragment-rewrite',
    'line-oa-description',
    'campaign-title',
    'campaign-summary',
  ]),
  targetLocale: z.string().default('th'),
  tone: z.string().optional(),
  fieldLabel: z.string().optional(),
  currentValue: z.string().optional(),
  instruction: z.string().optional(),
  context: z.object({
    entityId: z.string().optional(),
    entityType: z.string(),
    name: z.string().optional(),
    systemPrompt: z.string().optional(),
    skillPromptFragment: z.string().optional(),
    brandId: z.string().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  }),
});
```

Response shape:

```ts
const workspaceTextAssistResponseSchema = z.object({
  kind: z.string(),
  suggestions: z.array(z.string()),
  modelId: z.string(),
});
```

Guidance:

- text assist returns suggestions, not direct mutations
- caller chooses whether to replace, append, or ignore
- keep response format small and deterministic

---

## Prompt Strategy

Prompts should be built per assist kind, not with one generic "help write this" prompt.

Suggested split:

- `buildAgentDescriptionPrompt(input)`
- `buildAgentStarterPrompt(input)`
- `buildSkillDescriptionPrompt(input)`
- `buildCoverImagePrompt(input)`

Each prompt should define:

- role of the model
- target output shape
- length limit
- language expectations
- what source fields are authoritative
- what not to do

Example principles:

- use the entity name and system prompt as primary inputs for agent-description
- use SKILL.md body and existing description as primary inputs for skill-description
- keep outputs concise and UI-ready
- never return explanations when the route expects fillable text

Important rule:

- Do not reuse the chat system prompt here.
- Do not inject `<available_skills>`, `<active_skills>`, or memory blocks.

---

## Model Selection

Workspace AI assist should use a simpler model policy than chat.

Recommended default:

- fast text model for text assists
- image-capable generation model for cover creation

Recommended implementation:

- add a tiny resolver inside `features/workspace-ai/models.ts`
- prefer one default model per assist class
- allow future per-kind overrides

Example:

```ts
function getWorkspaceAssistModel(kind: WorkspaceTextAssistKind): string {
  switch (kind) {
    case 'agent-starters':
      return 'google/gemini-2.5-flash-lite';
    default:
      return 'google/gemini-2.5-flash-lite';
  }
}
```

Do not reuse chat intent routing from `features/chat/server/routing.ts` unless there is a very strong reason.

That router solves a different problem.

---

## Credits

Text assists and image assists should follow different credit behavior.

### Text assist

Recommended v1:

- use a flat, low cost per request
- or reuse `getCreditCost(modelId)` if the team wants immediate consistency

Text assists should stay cheap because they are short, transactional, and often repeated during editing.

### Image assist

Use the existing image credit flow:

- validate model
- resolve image cost
- deduct before creation
- refund on failure

Important rule:

- keep credit deduction in the route/service layer
- do not let client components guess the cost

---

## Persistence And Audit

Persistence should also be split by assist type.

### Text assist persistence

Recommended v1:

- no draft-output persistence by default
- no `chatMessage` records
- no thread ownership

Why:

- these are ephemeral suggestions
- storing every draft may create noise and privacy overhead

If audit is required later, prefer one of these:

1. add a dedicated `workspace_ai_run` table
2. or carefully extend `toolRun` only if the team wants one shared run ledger

Do not overload `chatMessage` for editor assists.

### Image assist persistence

Use the shipped async generation persistence:

- `toolRun`
- `toolArtifact` when needed
- `mediaAsset` once persisted into the app's gallery/storage layer

This is already the correct pattern for generated media.

---

## UI Integration Pattern

Editors should expose AI actions as optional helpers, not as required steps.

Recommended UI behaviors:

- small `Write with AI` or `Rewrite` button beside a field
- `Generate cover` button beside image upload
- return 1 to 4 suggestions
- let the user choose `Replace`, `Insert`, or `Try again`
- do not auto-save after generation

Important rule:

- AI output should modify local draft state first
- actual DB persistence should happen only on normal form save

This keeps editor behavior predictable and avoids accidental data loss.

---

## Example Flows

## Flow A: Write agent description

```text
Agent editor
  -> user clicks "Write with AI"
  -> client sends:
       kind = "agent-description"
       context = { name, systemPrompt, brandId, current description }
  -> /api/workspace-ai/text
  -> features/workspace-ai/service.ts
  -> generate short description suggestions
  -> client shows 3 suggestions
  -> user applies one to local form state
  -> user clicks Save
  -> normal /api/agents route persists the agent
```

## Flow B: Generate agent cover image

```text
Agent editor
  -> user clicks "Generate cover"
  -> client sends:
       subject context from agent name, description, system prompt, optional custom style prompt
  -> /api/workspace-ai/image
  -> features/workspace-ai/service.ts builds final image prompt
  -> features/image/service.ts triggers async generation
  -> client polls existing generation status route
  -> user previews result
  -> user accepts result into imageUrl draft field
  -> user clicks Save
```

## Flow C: Rewrite skill description

```text
Skill editor
  -> user clicks "Rewrite"
  -> client sends:
       kind = "skill-description"
       context = { name, promptFragment, triggerType, trigger, enabledTools }
  -> /api/workspace-ai/text
  -> returns concise marketplace-style description options
  -> user picks one
  -> user saves through existing skill mutation route
```

---

## File-By-File Implementation Map

Recommended first slice:

### New files

- `docs/workspace-ai-assist-implementation.md`
- `features/workspace-ai/schema.ts`
- `features/workspace-ai/types.ts`
- `features/workspace-ai/prompts.ts`
- `features/workspace-ai/service.ts`
- `app/api/workspace-ai/text/route.ts`
- `app/api/workspace-ai/image/route.ts`

### Existing files likely to change

- `features/agents/components/agent-general-section.tsx`
- `features/skills/components/skill-editor-panel.tsx`
- optional future editors in LINE OA, content, and brands

### Existing modules to reuse

- `lib/ai.ts`
- `lib/credits.ts`
- `lib/api/creditGate.ts`
- `features/image/service.ts`
- `app/api/generate/status/route.ts`
- `app/api/generate/persist/route.ts`
- `docs/media-upload-guide.md`

---

## Canonical API Rules

Any future workspace AI assist implementation should preserve these invariants.

### Rule 1

One canonical assist service module:

- `features/workspace-ai/service.ts`

### Rule 2

No editor assist may directly call `app/api/chat/route.ts`.

### Rule 3

No editor assist may persist output as chat transcript.

### Rule 4

Generated text is advisory draft output until the user applies it.

### Rule 5

Generated images should reuse the existing async generation pipeline.

### Rule 6

Prompt contracts must be per assist kind, not one generic helper prompt.

### Rule 7

Client components must not contain hidden business logic for prompt building or model choice.

### Rule 8

If a new assist needs durable logs, add a dedicated persistence contract instead of silently writing to unrelated tables.

---

## Safety And Quality Guidelines

Text assists should:

- stay within a defined max length
- avoid claims not grounded in the provided editor context
- preserve the user's language when possible
- default to Thai-ready UX where appropriate
- avoid sounding like a chatbot reply when the output is meant for a label or description field

Image assists should:

- derive prompt from editor context plus optional user instruction
- avoid implying copyrighted brand elements unless the user explicitly supplied them
- keep cover output aligned with the entity's role

For all assists:

- never auto-publish
- never auto-share
- never auto-save
- always allow human review before persistence

---

## Recommended Phase Plan

## Phase 1: Text assist foundation

Goal:

- ship a reusable text assist runtime for agents and skills

Deliverables:

- text assist schemas
- text assist service
- `/api/workspace-ai/text`
- agent description assist
- skill description assist
- starter prompt suggestions

Acceptance criteria:

- users can generate field suggestions without entering chat
- generated values only update local editor state
- no chat messages are created

## Phase 2: Cover image generation

Goal:

- enable AI-generated cover images inside editors

Deliverables:

- `/api/workspace-ai/image`
- prompt builder for cover generation
- editor preview/accept flow
- reuse of existing generation status and persist routes

Acceptance criteria:

- cover generation works from the editor
- final accepted image lands in the same `imageUrl` flow as uploaded covers
- generation uses existing async persistence patterns

## Phase 3: Shared UI primitives

Goal:

- make future adoption cheap across product surfaces

Deliverables:

- reusable text-assist button/component
- reusable suggestion picker UI
- reusable image-assist trigger UI

Acceptance criteria:

- new editors can add assists with minimal duplication
- prompt logic still stays inside `features/workspace-ai/`

## Phase 4: Audit and analytics

Goal:

- add observability if needed

Deliverables:

- assist usage metrics
- optional run ledger
- failure tracking by assist kind

Acceptance criteria:

- team can answer which assists are used, successful, or failing
- persistence remains separate from chat history

---

## Testing Guidance

Minimum recommended coverage:

### Unit tests

- request schema validation
- per-kind prompt builders
- output parsing and normalization
- model selection helpers

### Integration tests

- auth rejection
- invalid request rejection
- successful text assist response
- successful image assist trigger
- credit failure behavior

### UI tests

- apply suggestion updates local state only
- cancel leaves field unchanged
- save persists only through normal entity mutation

---

## Future Extensions

This architecture should support later assists for:

- brands
- content calendar
- content pieces
- LINE OA configuration
- knowledge document summaries
- team descriptions

If the number of assist kinds grows significantly, add an internal registry:

```text
features/workspace-ai/registry.ts
```

That registry can hold:

- kind metadata
- label
- default model
- max suggestions
- prompt builder
- parser

Do not build that registry before there are enough assist kinds to justify it.

---

## Recommended First Implementation Slice

If only one slice is implemented first, it should be:

1. `agent-description`
2. `agent-starters`
3. `skill-description`

Why this slice first:

- no async polling needed
- immediate UX value
- low risk
- establishes the contract before media generation is added

After that, add:

4. `agent-cover-image`

---

## Final Guidance For Future Contributors

When adding a new workspace AI assist:

1. decide whether it is text assist or image assist
2. add a narrow schema
3. add a dedicated prompt builder
4. implement the logic in `features/workspace-ai/service.ts`
5. expose a thin API route
6. update the editor UI to consume suggestions as local draft state
7. add tests
8. update this document if the contract or architecture changes

The main success condition is not "we used AI in more places."

The success condition is:

- editor AI is fast
- editor AI is predictable
- editor AI is cheaper than chat
- editor AI does not pollute chat history
- editor AI stays easy to extend without duplicating logic
