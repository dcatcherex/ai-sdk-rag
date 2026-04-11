# AI Audit And Observability Implementation Guide

## Purpose

This document defines the recommended audit and observability architecture for AI execution inside Vaja.

It is intended for:

- future developers maintaining AI runtime code
- AI coding agents implementing or extending telemetry
- product and platform work that needs reliable reporting later

This guide focuses primarily on the main AI chat route in `app/api/chat/route.ts`, while also explaining how that work should align with the newer workspace-AI audit layer.

---

## Current Progress

Implemented now:

- `chat_run` ledger in `db/schema/chat.ts`
- SQL migration:
  - `db/migrations/0049_chat_run.sql`
- audit helper layer:
  - `features/chat/audit/audit.ts`
  - `features/chat/audit/schema.ts`
  - `features/chat/audit/queries.ts`
  - `features/chat/audit/types.ts`
- main chat route integration in `app/api/chat/route.ts`
  - validated chat requests now create a `chat_run`
  - routing metadata is recorded
  - success and error completion paths update the run row
  - token totals, credit cost, route kind, and tool usage summary are recorded
- authenticated observability APIs:
  - `GET /api/chat-runs`
  - `GET /api/chat-runs/[runId]`
- shared client/UI layer:
  - `features/chat/client.ts`
  - `features/chat/hooks/use-chat-runs.ts`
  - `features/chat/components/chat-runs-card.tsx`
- first product surface:
  - Settings page now shows a chat observability card
- admin observability surface:
  - `GET /api/admin/chat-runs`
  - `GET /api/admin/chat-runs/[runId]`
  - `/admin/chat-runs`
  - admin dashboard and sidebar now link to chat run reporting
  - shared date-range filtering for admin chat run reporting
  - admin page now also shows `workspace_ai_run` activity in the same observability panel
  - `GET /api/admin/workspace-ai-runs`
  - `GET /api/admin/workspace-ai-runs/[runId]`
  - admin page now also shows `tool_run` activity in the same observability panel
  - `GET /api/admin/tool-runs`
  - `GET /api/admin/tool-runs/[runId]`
  - unified cross-runtime admin timeline:
    - `GET /api/admin/ai-runs`
    - `All Runs` tab in `/admin/chat-runs`
  - trend analytics over time:
    - `GET /api/admin/ai-runs/trends`
    - daily counts, errors, token usage, and credits in the admin panel

Not implemented yet:

- no export / CSV layer yet
- no chart visualization layer yet

---

## Problem Summary

Vaja currently has meaningful operational data for AI activity, but most of it is distributed across multiple tables and runtime paths.

For the main chat route, data is currently spread across:

- `chatMessage` in `db/schema/chat.ts`
- `tokenUsage` in `db/schema/chat.ts`
- `creditTransaction` in `db/schema/credits.ts`
- `toolRun` in `db/schema/tools.ts`

This is useful for product behavior and billing, but it is not yet a clean observability system.

Today, the platform does not have one canonical record that answers:

- which chat request happened
- who triggered it
- which model was requested
- which model was actually used
- whether routing was manual or auto
- whether the request succeeded or failed
- whether tools were used
- whether the route took the text path or image path
- how many tokens were used
- how many credits were charged
- how long the request took

That missing top-level record makes reporting and debugging harder than it should be.

---

## Current State

### Main chat route

Current route:

- `app/api/chat/route.ts`

Current supporting persistence:

- `features/chat/server/persistence.ts`
- `db/schema/chat.ts`
- `db/schema/credits.ts`
- `db/schema/tools.ts`

What exists now:

- full chat transcript persistence
- per-thread token usage records
- credit deduction ledger
- tool execution ledger
- thread-level usage API in `app/api/threads/[threadId]/usage/route.ts`

What does not exist yet:

- no dedicated `chat_run` table
- no canonical per-request audit row for main chat
- no shared query layer for chat observability
- no report screen for chat runs

### Workspace AI assist

Workspace AI now has a stronger observability foundation than the main chat route.

Existing pieces:

- `workspace_ai_run` in `db/schema/tools.ts`
- `features/workspace-ai/audit.ts`
- `features/workspace-ai/queries.ts`
- `GET /api/workspace-ai/runs`
- `features/workspace-ai/hooks/use-workspace-ai-runs.ts`
- `features/workspace-ai/components/workspace-ai-runs-card.tsx`

This is a useful pattern to reuse, but the main chat route is more complex and should not be forced into exactly the same schema without thought.

---

## Decision

The main chat route should get its own dedicated audit ledger:

- `chat_run`

This should be separate from:

- `chatMessage`
- `tokenUsage`
- `creditTransaction`
- `toolRun`
- `workspace_ai_run`

Important rule:

- do not try to make `chatMessage` serve as observability
- do not overload `tokenUsage` into a request ledger
- do not merge main chat observability into `workspace_ai_run`

Each table has a different job.

---

## Core Concept: `chat_run`

`chat_run` should represent one top-level request into the main AI chat route.

That means:

- one incoming request to `POST /api/chat`
- one row in `chat_run`

This row becomes the canonical audit summary for that request.

### `chat_run` is not

- not the message transcript
- not the billing ledger
- not the token detail ledger
- not the per-tool execution ledger

### `chat_run` is

- the request-level execution ledger
- the top-level summary record
- the main source for observability and reporting

---

## Why A Dedicated Ledger Is Needed

Without `chat_run`, any report screen would need to infer behavior by stitching together:

- thread data
- message data
- token rows
- credit rows
- tool rows

That creates several problems:

- expensive queries
- ambiguous joins
- hard-to-explain counts
- weak failure analysis
- fragile future reporting

With `chat_run`, each request has one authoritative summary row, and lower-level tables remain specialized detail stores.

---

## Recommended Data Model

Suggested table:

```text
chat_run
```

Suggested fields:

- `id`
- `user_id`
- `thread_id`
- `agent_id`
- `brand_id`
- `status`
- `route_kind`
- `requested_model_id`
- `resolved_model_id`
- `routing_mode`
- `routing_reason`
- `use_web_search`
- `used_tools`
- `tool_call_count`
- `input_json`
- `output_json`
- `error_message`
- `credit_cost`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `started_at`
- `completed_at`
- `created_at`

Suggested enums / constrained string fields:

- `status`: `pending | success | error`
- `route_kind`: `text | image`
- `routing_mode`: `manual | auto`

Notes:

- `requested_model_id` is what the client or agent asked for
- `resolved_model_id` is what routing actually used
- `route_kind` should reflect whether the main route ended in text generation or image generation
- `input_json` should be intentionally limited and sanitized
- `output_json` should store summary metadata, not full message transcript content

---

## Relationship To Existing Tables

The intended responsibilities should stay clear.

### `chatMessage`

Purpose:

- conversation transcript

Do not use for:

- request-level analytics
- run success/failure reporting

### `tokenUsage`

Purpose:

- token accounting details

Do not use for:

- top-level request identity
- request success/failure reporting

### `creditTransaction`

Purpose:

- financial / credit ledger

Do not use for:

- execution observability

### `toolRun`

Purpose:

- tool execution tracking

Do not use for:

- top-level chat request identity

### `workspace_ai_run`

Purpose:

- field-assist editor actions outside main chat

Do not use for:

- conversational route observability

### `chat_run`

Purpose:

- top-level main chat request observability

This table should become the first place to query when answering:

- how many chat requests ran
- which ones failed
- which models were used
- how routing behaved
- how often tools were used
- how much cost and token usage main chat generated

---

## Audit Boundaries

Observability should capture operational facts, not become a second transcript store.

### Safe to store in `input_json`

- request metadata
- whether an agent was used
- whether documents were selected
- selected document count
- enabled tool IDs or summary
- message count
- last user prompt length
- flags like `useWebSearch`

### Usually avoid storing in `input_json`

- full raw transcript
- full user messages
- full uploaded content
- full memory blocks
- full skill prompt blocks

### Safe to store in `output_json`

- final route kind
- whether tools were used
- tool names used
- generated image metadata
- follow-up suggestion count
- summary booleans like `memoryExtracted`

### Usually avoid storing in `output_json`

- full assistant message body
- large generated payloads already persisted elsewhere

Important rule:

- audit rows should summarize execution
- transcript tables should hold transcript content

---

## Lifecycle In The Main Route

Recommended flow inside `app/api/chat/route.ts`:

### Stage 1: Start run

After:

- auth succeeds
- request body validates

Create a `chat_run` row with:

- `status = pending`
- `threadId`
- `userId`
- requested model
- request metadata summary

### Stage 2: Enrich run with routing

After model resolution:

- set `resolvedModelId`
- set `routingMode`
- set `routingReason`
- set `routeKind` expectation if known

### Stage 3: Complete on success

After generation and persistence:

- mark `status = success`
- set token counts
- set credit cost
- set tool usage summary
- set completion timestamp

### Stage 4: Complete on failure

On any route failure after run creation:

- mark `status = error`
- store `errorMessage`
- set completion timestamp

Important rule:

- the route should never leave a successful request as `pending`
- if the process crashes mid-flight, stale `pending` rows are acceptable and useful for debugging

---

## Recommended Server Modules

Suggested implementation layout:

```text
features/chat/audit/
  schema.ts          <- optional response/query schemas
  types.ts           <- shared types
  audit.ts           <- start/complete helpers
  queries.ts         <- reporting queries
```

Likely API routes:

```text
app/api/chat-runs/route.ts
app/api/chat-runs/[runId]/route.ts
```

Possible future admin routes:

```text
app/api/admin/chat-runs/route.ts
```

Important rule:

- keep request audit helpers separate from transcript persistence helpers
- `features/chat/server/persistence.ts` should keep owning transcript/message persistence

---

## Suggested Helper Functions

Recommended audit helpers:

- `startChatRun()`
- `updateChatRunRouting()`
- `completeChatRunSuccess()`
- `completeChatRunError()`
- `buildChatRunInputSummary()`
- `buildChatRunOutputSummary()`

These should be thin, predictable, and safe to call from the route.

---

## Query Layer Requirements

Do not build reporting UI directly on raw table reads.

Add a shared query layer first.

Recommended first query functions:

- `getChatRunsOverview(userId, options)`
- `getChatRunById(runId, userId)`
- `getChatRunSummary(userId, window)`

Recommended overview output:

- total runs
- success count
- error count
- pending count
- counts by route kind
- counts by resolved model
- counts by routing mode
- recent runs

This should mirror the pattern already used by workspace AI observability.

---

## UI Layer Recommendations

Do not start with a complicated analytics dashboard.

Recommended first UI slice:

- a simple recent-runs card
- summary counts
- status badges
- route kind
- model used
- created time
- error message if any

Possible component shape:

```text
features/chat/components/chat-runs-card.tsx
features/chat/hooks/use-chat-runs.ts
```

The first UI can live in:

- admin area
- internal settings page
- developer-only diagnostics page

Important rule:

- build the ledger first
- build the query layer second
- build the UI third

---

## Recommended Phase Plan

## Phase 1: Main route ledger foundation

Goal:

- add canonical top-level audit for `app/api/chat/route.ts`

Deliverables:

- `chat_run` schema
- migration
- audit helpers
- route integration

Acceptance criteria:

- every validated main chat request creates a `chat_run`
- successes and failures are both recorded
- token and credit summary fields are captured when available

## Phase 2: Query and API layer

Goal:

- make chat observability readable without ad hoc SQL

Deliverables:

- shared query module
- authenticated user-facing route
- optional admin route

Acceptance criteria:

- recent runs can be fetched consistently
- summary counts are available by status and model

## Phase 3: Reusable UI

Goal:

- make observability available in the product without custom one-off code

Deliverables:

- shared client helper
- TanStack Query hook
- reusable recent-runs card

Acceptance criteria:

- one screen can render chat run activity with minimal wiring

## Phase 4: Cross-runtime reporting

Goal:

- unify reporting across main chat, workspace AI, and tools

Deliverables:

- shared terminology
- common dashboard filters
- optional higher-level analytics page

Acceptance criteria:

- the team can compare conversational AI activity with workspace assists and tool executions

---

## Cross-Runtime Design Rules

If multiple AI runtimes exist, observability should stay parallel, not collapsed into one vague table.

Recommended ledgers:

- `chat_run` for main conversational route
- `workspace_ai_run` for editor assists
- `tool_run` for tool execution
- team-run tables for multi-agent orchestration

This keeps each ledger semantically clean.

Higher-level reporting can combine them later through a query layer or analytics view.

Do not merge fundamentally different runtimes too early.

---

## Failure Tracking Guidance

Store operationally useful failure data.

Good examples:

- model provider error
- validation mismatch
- persistence failure
- tool planning failure
- credit failure after route start

Avoid:

- giant stack traces inside DB rows
- sensitive raw prompt content

Recommended pattern:

- store a short `errorMessage`
- log full server details separately with `console.error` or future logging infra

---

## Performance Guidance

Observability should not noticeably slow the main route.

Guidelines:

- keep `input_json` and `output_json` compact
- avoid large JSON blobs
- avoid duplicate writes of already-persisted content
- use indexed filter columns for common queries
- prefer summary writes over reconstructive joins later

Suggested indexes:

- `user_id`
- `thread_id`
- `agent_id`
- `status`
- `resolved_model_id`
- `created_at`

---

## Security And Privacy Guidance

Audit data must be treated as sensitive operational metadata.

Rules:

- never expose another user's run data in user-facing routes
- avoid storing full prompt transcript copies unless there is a clear approved reason
- redact or omit sensitive large inputs from audit JSON
- keep admin reporting separate from user reporting

---

## Suggested First Schema Draft

Illustrative example only:

```ts
export const chatRun = pgTable('chat_run', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  threadId: text('thread_id').notNull(),
  agentId: text('agent_id'),
  brandId: text('brand_id'),
  status: text('status').notNull().default('pending'),
  routeKind: text('route_kind').notNull().default('text'),
  requestedModelId: text('requested_model_id'),
  resolvedModelId: text('resolved_model_id'),
  routingMode: text('routing_mode'),
  routingReason: text('routing_reason'),
  useWebSearch: text('use_web_search'),
  toolCallCount: integer('tool_call_count').notNull().default(0),
  inputJson: jsonb('input_json').notNull(),
  outputJson: jsonb('output_json'),
  errorMessage: text('error_message'),
  creditCost: integer('credit_cost'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
```

Final field names can vary, but the role of the table should remain the same.

---

## Maintenance Guidance For Future Developers

When changing `app/api/chat/route.ts`, ask:

1. does this change affect request-level observability
2. does `chat_run` need a new field or summary value
3. does the query layer need to expose new data
4. does any reporting UI depend on this field

When adding a new chat execution branch:

- update the audit helper
- do not hide new behavior from observability

When adding a new AI runtime outside main chat:

- decide whether it needs its own ledger
- do not automatically write into `chat_run`

---

## Final Guidance

The key design principle is simple:

- transcripts are for conversations
- billing tables are for money
- tool tables are for tools
- run ledgers are for observability

For the main AI route, `chat_run` should become that observability layer.

That will make future debugging, cost analysis, admin reporting, and reliability work much easier to maintain without overloading unrelated tables.
