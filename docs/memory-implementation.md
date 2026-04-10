# Memory Implementation Guide

This document describes the memory system that is currently shipped in Vaja AI.

Use it as the source of truth for the existing behavior before changing chat memory, LINE memory behavior, memory settings, or prompt assembly.

Important framing:

- The current implementation is a `user profile memory` system.
- It is useful and worth keeping.
- It is not yet the full memory architecture required by the Vaja vision in `docs/vaja-vision.md`.

If you are designing the future system, read this together with `docs/memory-recommendation.md`.

## What Exists Today

The shipped memory system stores small durable facts about a user and injects them back into future prompts so responses can feel more personalized and context-aware.

Today it is:

- user-scoped, not workspace-scoped
- fact-based, not search-based
- prompt-injected, not retrieved by relevance
- shared across web chat and linked LINE OA conversations
- backed by Postgres via Drizzle

Today it is not:

- semantic memory
- vector memory
- agent-scoped business memory
- project or workspace memory
- durable thread working memory
- autonomous agent-note memory

## Current Position in the Vaja Stack

The current system should be understood as one memory layer only:

- `user profile memory`

It helps with:

- user preferences
- user expertise
- stable personal context
- long-running personal goals

It does not yet provide:

- long-term memory of a business or brand
- shared memory across agents and teams
- selective memory retrieval by relevance
- durable working memory for long sessions
- agent-authored operating notes

## Canonical Files

### Core implementation

- `lib/memory.ts`
  - `resolveMemoryPreferences(...)`
  - `getUserMemoryContext(userId)`
  - `getLineUserMemoryContext(lineUserId)`
  - `extractAndStoreMemory(...)`
  - `extractAndStoreLineUserMemory(...)`
  - `mergeLineMemoryToUser(...)`

### Database

- `db/schema/users.ts`
  - `userPreferences`
  - `userMemory`

### Runtime integration

- `app/api/chat/route.ts`
- `features/line-oa/webhook/events/message.ts`
- `app/api/compare/route.ts`
- `features/chat/server/prompt-assembly.ts`

### User-facing APIs and UI

- `app/api/user/preferences/route.ts`
- `app/api/user/memory/route.ts`
- `app/api/user/memory/[id]/route.ts`
- `features/settings/components/memory-section.tsx`

### Related context-management code

- `lib/conversation-summary.ts`

This is not durable memory storage. It is temporary conversation compaction used to reduce prompt size inside a request.

## Data Model

Memory is stored in the `user_memory` table in `db/schema/users.ts`.

Current fields:

- `id`: primary key
- `userId`: owning Vaja user
- `lineUserId`: owning LINE user for unlinked accounts
- `category`: category string
- `fact`: stored fact text
- `sourceThreadId`: optional origin thread
- `createdAt`: insert timestamp

Current indexes:

- `user_memory_userId_idx`
- `user_memory_lineUserId_idx`

## User Preference Flags

Memory behavior is controlled by three flags on `user_preferences`:

- `memoryEnabled`
- `memoryInjectEnabled`
- `memoryExtractEnabled`

Meaning:

- `memoryEnabled`: master switch
- `memoryInjectEnabled`: allow prompt injection
- `memoryExtractEnabled`: allow background extraction

Default behavior when no preference row exists:

- all three behave as `true`

The canonical resolver is:

- `resolveMemoryPreferences(...)` in `lib/memory.ts`

All entry points should use that helper for linked users.

## High-Level Runtime Flow

### Web chat flow

1. `app/api/chat/route.ts` loads user preferences.
2. If memory injection is enabled, it calls `getUserMemoryContext(userId)`.
3. The returned block is appended to the system prompt via `assembleSystemPrompt(...)`.
4. The model responds.
5. After persistence completes, `extractAndStoreMemory(...)` runs in the background if extraction is enabled.

### LINE OA flow

1. `features/line-oa/webhook/events/message.ts` resolves the linked app user, if any.
2. For a linked Vaja user, it resolves preferences with `resolveMemoryPreferences(...)`.
3. If injection is enabled, it loads `getUserMemoryContext(userId)`.
4. For an unlinked LINE user, it loads `getLineUserMemoryContext(lineUserId)` and treats memory as enabled by default.
5. The memory block is appended to the LINE system prompt via `assembleSystemPrompt(...)`.
6. After the AI reply is generated, extraction runs in the background when enabled.

### Compare flow

1. `app/api/compare/route.ts` loads user preferences.
2. If memory injection is enabled, it loads `getUserMemoryContext(userId)`.
3. Memory is currently used for prompt enhancement only.
4. Compare mode does not extract new memory.

## Prompt Format

`getUserMemoryContext()` and `getLineUserMemoryContext()` render memory as:

```xml
<user_context>
[context] Works on an AI cowork platform for Thai users
[expertise] Senior React and Next.js developer
[preference] Prefers concise answers
</user_context>
```

Formatting behavior:

- facts are fetched newest first
- injection is capped by character budget, not only by row count
- injection is capped per category to avoid one category dominating
- if no memory exists, an empty string is returned

Current prompt guards in `lib/memory.ts`:

- storage limit: `MAX_FACTS_PER_USER = 50`
- injection budget: `INJECTION_MAX_CHARS = 2400`
- category cap: `INJECTION_MAX_FACTS_PER_CATEGORY = 8`

## Extraction Pipeline

`extractAndStoreMemory(...)` in `lib/memory.ts` is the only canonical extractor for linked users.

`extractAndStoreLineUserMemory(...)` is the parallel entry point for unlinked LINE users.

### Input shaping

- only `user` and `assistant` messages are considered
- only the last `10` messages are used
- each message is truncated to `500` characters
- text is collected from `parts[]` when present, otherwise from `content`

### Extraction model

The extractor currently uses:

- `google/gemini-2.5-flash-lite`

### Allowed categories

The extractor prompt requests these categories:

- `preference`
- `expertise`
- `context`
- `goal`

### Extractor rules

The model is instructed to:

- extract facts about the user only
- skip assistant facts
- return only new facts not already in the injected memory block
- return JSON array output
- return at most `5` facts per call

### Validation and dedup

After generation:

- JSON is parsed from the first array-looking substring
- rows with missing category or fact are dropped
- facts shorter than `6` characters are dropped
- stored facts are normalized with lowercase plus non-alphanumeric stripping
- exact and simple substring duplicates are skipped

### Retention

- at most `50` rows are kept per owner
- oldest rows are deleted first when a new insert would overflow

### Persistence

Each saved row currently stores:

- generated `id`
- `userId` or `lineUserId`
- `category`
- `fact`
- `sourceThreadId`

## Account Linking Behavior

The system supports memory continuity between unlinked LINE users and linked Vaja accounts.

When a LINE user later links their account:

- `mergeLineMemoryToUser(lineUserId, userId)` migrates their LINE-keyed memory rows into the Vaja user scope

This gives Vaja a useful continuity bridge between:

- LINE as the front door
- web chat as the control room

## Manual Memory Management

Users can manage current profile memory through the settings UI.

### API routes

- `GET /api/user/memory`
  - list all facts for the current user
- `POST /api/user/memory`
  - create one fact manually
- `DELETE /api/user/memory`
  - delete all facts for the current user
- `PATCH /api/user/memory/[id]`
  - update `fact` and/or `category`
- `DELETE /api/user/memory/[id]`
  - delete one fact

### Settings UI

`features/settings/components/memory-section.tsx` currently provides:

- grouped fact display by category
- add fact
- edit fact
- delete fact
- clear all facts
- toggles for injection and extraction

## Important Behavioral Notes

### 1. Memory is user-level, not thread-level

All chat threads for the same user share the same memory pool.

### 2. Memory is user-level, not agent-level

Different agents currently see the same injected user profile memory.

### 3. Memory is appended to the system prompt

This means it participates as prompt context, not as a retrieval tool result.

### 4. Extraction is fire-and-forget

Runtime integrations call extraction with `void`, so failures do not block the reply path.

### 5. Existing context is passed back into extraction

The extractor receives the already injected memory block so it can avoid obvious duplicates before DB-level dedup runs.

### 6. Conversation summaries are not durable memory

`lib/conversation-summary.ts` helps with prompt compaction only.

It does not currently create:

- persistent thread memory
- searchable continuity archive
- reusable decision memory

## Current Strengths

The shipped design is strongest in these areas:

- simple mental model
- clear code ownership
- low operational complexity
- useful personalization wins
- web and LINE continuity for linked users
- manual review and editing

These are good properties and should be preserved when the system evolves.

## Current Gaps and Risks

These are the main limitations of the shipped implementation.

### 1. This is profile memory, not business memory

The system stores facts about a person, not durable shared knowledge about:

- a workspace
- a brand
- a project
- an agent team

### 2. No agent or team scope

The current table cannot cleanly answer:

- what should only this agent remember?
- what should all marketing agents share?
- what belongs to the business rather than the user?

### 3. No selective retrieval

Current memory is injected wholesale within a small prompt budget. There is no semantic or relevance-based retrieval path.

### 4. No durable working memory

Long conversations are summarized ephemerally, but that summary is not persisted as a reusable thread memory object.

### 5. No trust or review metadata

Every fact is treated roughly the same. The schema does not record:

- confidence
- review status
- source message ID
- extractor version
- visibility
- expiry
- supersession

### 6. Manual APIs are weakly validated

Manual memory writes currently accept free-form categories and facts without a shared Zod contract.

### 7. No distinction between memory types

The current system does not separate:

- user-confirmed facts
- model-extracted profile facts
- shared business knowledge
- agent-authored notes

That distinction matters for trust and for future product UX.

## Rules for Future Changes

### If you are changing shipped profile-memory behavior

- update `lib/memory.ts` first
- keep linked-user and unlinked-LINE behavior explicit
- do not duplicate extraction logic in route handlers
- verify web, LINE, and compare still follow the same preference contract for linked users

### If you need new memory scopes

Do not overload `user_memory` to hold workspace, brand, project, or team memory.

Add separate tables or an explicit scoped memory model.

### If you need long-session continuity

Do not treat prompt summarization as long-term memory.

Add a dedicated working-memory or continuity layer.

### If you need semantic search

Do not bolt embeddings onto the current prompt-injection path invisibly.

Add a separate retrieval layer with clear interfaces and observability.

## Relationship to the Recommended Future System

The recommended future architecture for Vaja should be layered:

1. user profile memory
2. workspace or project memory
3. thread working memory
4. continuity archive and retrieval
5. agent-authored notes

The current implementation only covers layer 1, plus temporary conversation compaction.

That is an acceptable v1, but it should not be mistaken for the end-state memory architecture needed to support the Vaja vision.
