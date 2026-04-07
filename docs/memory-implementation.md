# Memory Implementation Guide

This document explains how user memory currently works in Vaja AI, where it is implemented, and how future contributors should extend it safely.

Use this as the source of truth before changing chat memory, LINE memory behavior, memory settings, or memory-related prompts.

## Purpose

The current memory system stores small long-term facts about a user and injects them back into future prompts so responses can feel personalized and context-aware.

Today it is:

- User-scoped, not agent-scoped
- Fact-based, not summary-based
- Text-first, with light categorization
- Shared between web chat and linked LINE OA conversations
- Backed by Postgres via Drizzle

It is not yet a semantic memory or vector memory system.

## High-Level Flow

### Web chat flow

1. `app/api/chat/route.ts` loads user preferences.
2. If memory injection is enabled, it calls `getUserMemoryContext(userId)`.
3. The returned memory block is appended to the system prompt.
4. The model responds.
5. After the response is persisted, `extractAndStoreMemory(...)` runs in the background.
6. New user facts are inserted into `user_memory`.

### LINE OA flow

1. `features/line-oa/webhook/events/message.ts` resolves the linked app user.
2. If a linked user exists, it loads memory with `getUserMemoryContext(userId)`.
3. That memory is appended to the LINE system prompt.
4. After the AI reply is generated, `extractAndStoreMemory(...)` runs in the background.

### Compare flow

1. `app/api/compare/route.ts` loads memory with `getUserMemoryContext(userId)`.
2. Memory is currently used only for prompt enhancement.
3. Compare mode does not extract new memory.

## Canonical Files

### Core implementation

- `lib/memory.ts`
  - `getUserMemoryContext(userId)`
  - `extractAndStoreMemory(userId, messages, threadId, existingContext)`

### Database

- `db/schema/users.ts`
  - `userPreferences`
  - `userMemory`

### Runtime integration

- `app/api/chat/route.ts`
- `features/line-oa/webhook/events/message.ts`
- `app/api/compare/route.ts`

### User-facing APIs and UI

- `app/api/user/preferences/route.ts`
- `app/api/user/memory/route.ts`
- `app/api/user/memory/[id]/route.ts`
- `features/settings/components/memory-section.tsx`

## Data Model

Memory is stored in the `user_memory` table defined in `db/schema/users.ts`.

Fields:

- `id`: primary key
- `userId`: owning user
- `category`: memory category string
- `fact`: stored fact text
- `sourceThreadId`: optional origin thread
- `createdAt`: insert timestamp

There is currently one index:

- `user_memory_userId_idx` on `userId`

## User Preference Flags

Memory behavior is controlled by three flags on `user_preferences`:

- `memoryEnabled`
- `memoryInjectEnabled`
- `memoryExtractEnabled`

Intended meaning:

- `memoryEnabled`: global master switch
- `memoryInjectEnabled`: allow prompt injection
- `memoryExtractEnabled`: allow background extraction

Default behavior when no preference row exists:

- all three are treated as `true`

## Current Prompt Format

`getUserMemoryContext()` returns a prompt block like:

```xml
<user_context>
[context] Works on an AI cowork platform for Thai users
[expertise] Senior React and Next.js developer
[preference] Prefers concise answers
</user_context>
```

Details:

- Memories are ordered by newest first
- At most `50` facts are included
- Categories are shown inline as `[category] fact`
- If no memory exists, an empty string is returned

## Extraction Pipeline

`extractAndStoreMemory()` in `lib/memory.ts` is the only canonical extractor.

### Input shaping

- Only `user` and `assistant` messages are considered
- Only the last `10` messages are used
- Each rendered message is truncated to `500` characters
- Text is collected from `parts[]` when present, otherwise from `content`

### Extraction model

The extractor currently uses:

- `google/gemini-2.5-flash-lite`

### Allowed categories

The prompt instructs the model to return only:

- `preference`
- `expertise`
- `context`
- `goal`

### Extractor rules

The model is asked to:

- extract facts about the user only
- skip assistant facts
- return only new facts not already in context
- return JSON array output
- return at most 5 facts per call

### Validation and dedup

After generation:

- JSON is parsed from the first array-looking substring
- facts with missing category or fact are dropped
- facts shorter than 6 characters are dropped
- stored facts are normalized with lowercase + non-alphanumeric stripping
- exact and simple substring duplicates are skipped

### Retention

- `MAX_FACTS_PER_USER = 50`
- if a new insert would exceed the limit, oldest rows are deleted first

### Persistence

Each saved fact stores:

- generated `id`
- `userId`
- `category`
- `fact` trimmed to `500` chars
- `sourceThreadId`

## Manual Memory Management

Users can manage memory through the settings UI.

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

`features/settings/components/memory-section.tsx` provides:

- grouped fact display by category
- add fact
- edit fact
- delete fact
- clear all facts
- client-side duplicate consolidation
- toggles for injection and extraction

## Important Behavioral Notes

### 1. Memory is user-level, not thread-level

All chat threads for the same user share the same memory pool.

### 2. Memory is user-level, not agent-level

Different agents see the same user memory if memory injection is enabled.

### 3. Memory is appended to the system prompt

This means memory participates as prompt context, not as tool output or retrieval output.

### 4. Extraction is fire-and-forget

`extractAndStoreMemory(...)` is called with `void` in runtime integrations, so failures do not block the response path.

### 5. Existing context is passed into extraction

The extractor prompt receives the already-injected memory block so the model can avoid obvious duplicates before the DB dedup step runs.

## Current Gaps and Risks

These are important to understand before extending the system.

### Preference mismatches across entry points

Web chat respects:

- `memoryEnabled`
- `memoryInjectEnabled`
- `memoryExtractEnabled`

Compare route currently loads memory directly and does not check the memory toggles before using it for prompt enhancement.

LINE OA currently loads and extracts memory for linked users without reading `user_preferences`, so it does not fully respect the same toggles as web chat.

If you change memory behavior, make sure all entry points follow the same contract.

### Category values are not enforced at the database layer

The extractor prompt prefers four categories, but manual APIs can store any string category. The settings UI already handles unknown categories by grouping them as `other`.

If stricter behavior is needed, add validation in the API layer or schema design.

### Dedup is heuristic only

Current dedup works for obvious string duplicates but not semantic duplicates.

Examples that may still duplicate:

- "Prefers short answers"
- "Likes concise responses"

### Memory injection can grow prompt size

The cap is only row-count based, not token-aware. Fifty long facts can still be expensive in prompt space.

### No confidence, freshness, or archival state

Every saved fact is treated equally. There is no score, confirmation flag, expiry, or soft-delete.

### No structured audit trail

Only `sourceThreadId` is stored. There is no source message ID, extraction timestamp metadata, or extractor version.

## Rules for Future Changes

### If you need to change extraction behavior

- Update `lib/memory.ts` first
- Keep extraction logic centralized there
- Do not duplicate extraction logic in route handlers

### If you need a new memory consumer

- Reuse `getUserMemoryContext()` unless you intentionally need a different memory view
- Document why a different formatter is required before introducing it

### If you need richer memory types

Prefer extending the schema deliberately instead of overloading `fact`.

Examples:

- `confidence`
- `updatedAt`
- `sourceMessageId`
- `visibility`
- `expiresAt`
- `confirmedByUser`

### If you need agent-scoped memory

Do not mix it into `user_memory` without a clear ownership model. Add a separate table or explicit scoping fields so user-global memory and agent-specific memory stay understandable.

### If you need semantic dedup or retrieval

Do not bolt that into the current string-based path implicitly. Introduce a second layer with clear naming, such as:

- memory embeddings
- memory search
- memory consolidation jobs

## Recommended Implementation Checklist

Use this checklist when changing memory behavior.

1. Update `lib/memory.ts` if extraction or formatting logic changes.
2. Check `app/api/chat/route.ts`, `app/api/compare/route.ts`, and `features/line-oa/webhook/events/message.ts` for contract consistency.
3. Update `app/api/user/preferences/route.ts` if preference semantics change.
4. Update `features/settings/components/memory-section.tsx` if the UX contract changes.
5. Add or update migrations if schema changes.
6. Verify manual CRUD still works for old and new records.
7. Verify chat, LINE, and compare flows all behave intentionally.

## Recommended Near-Term Improvements

If the team revisits memory soon, these are the safest high-value upgrades:

1. Make compare and LINE honor the same memory preference flags as web chat.
2. Add Zod validation to manual memory APIs.
3. Enforce or normalize category values at write time.
4. Add tests around dedup, pruning, and prompt formatting.
5. Consider a token-aware injection cap instead of only row-count capping.

## Quick Reference

### Read memory

- `getUserMemoryContext(userId)`

### Extract memory

- `extractAndStoreMemory(userId, messages, threadId, existingContext)`

### Tables involved

- `user_preferences`
- `user_memory`

### Main toggles

- `memoryEnabled`
- `memoryInjectEnabled`
- `memoryExtractEnabled`

### Main entry points

- Web chat: `app/api/chat/route.ts`
- LINE OA: `features/line-oa/webhook/events/message.ts`
- Compare: `app/api/compare/route.ts`
