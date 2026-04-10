# Memory Implementation Guide

This document describes the memory system currently shipped in Vaja AI.

Use it as the source of truth before changing:
- profile memory in `lib/memory.ts`
- shared brand memory in `features/memory/service.ts`
- thread working memory in `features/memory/service.ts`
- prompt assembly in `features/chat/server/prompt-assembly.ts`
- memory-related UI or APIs

Read this together with:
- `docs/prompt-architecture.md`
- `docs/memory-recommendation.md`

---

## What Exists Today

Vaja now ships three memory layers:

1. `user profile memory`
2. `shared brand memory`
3. `thread working memory`

What is still not shipped:
- workspace memory
- project memory
- continuity archive retrieval across threads
- prompt-injected agent-authored notes
- vector-backed memory retrieval

---

## Current Position in the Vaja Stack

### Layer 1: User profile memory

Purpose:
- personalization
- stable user context across web and LINE
- small durable facts about the individual

### Layer 2: Shared brand memory

Purpose:
- durable business knowledge shared across chats for a brand
- approved terminology, voice rules, process rules, constraints

Current scope:
- `brand` only

### Layer 3: Thread working memory

Purpose:
- preserve current thread state without replaying the full transcript every turn
- maintain objective, decisions, open questions, and recent artifacts

Behavior:
- system-managed
- persisted per thread
- inspectable and clearable in the chat UI
- not user-editable

---

## Canonical Files

### User profile memory

- `lib/memory.ts`
  - `resolveMemoryPreferences(...)`
  - `getUserMemoryContext(userId)`
  - `getLineUserMemoryContext(lineUserId)`
  - `extractAndStoreMemory(...)`
  - `extractAndStoreLineUserMemory(...)`
  - `mergeLineMemoryToUser(...)`

### Shared memory and working memory

- `features/memory/service.ts`
  - `listBrandMemory(...)`
  - `createBrandMemory(...)`
  - `updateBrandMemory(...)`
  - `approveBrandMemory(...)`
  - `rejectBrandMemory(...)`
  - `archiveBrandMemory(...)`
  - `deleteBrandMemory(...)`
  - `buildBrandMemoryPromptBlock(...)`
  - `buildThreadWorkingMemoryPromptBlock(...)`
  - `refreshThreadWorkingMemory(...)`
  - `refreshThreadWorkingMemoryFromMessages(...)`
  - `clearThreadWorkingMemory(...)`

### Database

- `db/schema/users.ts`
  - `userPreferences`
  - `userMemory`
- `db/schema/memory.ts`
  - `memoryRecord`
  - `threadWorkingMemory`

### Runtime integration

- `app/api/chat/route.ts`
- `features/line-oa/webhook/events/message.ts`
- `features/chat/server/prompt-assembly.ts`

### User-facing APIs and UI

- `app/api/user/memory/route.ts`
- `app/api/user/memory/[id]/route.ts`
- `app/api/brands/[id]/memory/route.ts`
- `app/api/brands/[id]/memory/[memoryId]/route.ts`
- `app/api/brands/[id]/memory/[memoryId]/approve/route.ts`
- `app/api/brands/[id]/memory/[memoryId]/reject/route.ts`
- `app/api/brands/[id]/memory/[memoryId]/archive/route.ts`
- `app/api/threads/[threadId]/working-memory/route.ts`
- `app/api/threads/[threadId]/working-memory/refresh/route.ts`
- `features/settings/components/memory-section.tsx`
- `features/memory/components/brand-memory-tab.tsx`
- `features/memory/components/thread-working-memory-sheet.tsx`

---

## Data Model

### 1. `user_memory`

This remains the profile-memory table in `db/schema/users.ts`.

Fields:
- `id`
- `userId`
- `lineUserId`
- `category`
- `fact`
- `sourceThreadId`
- `createdAt`

Use it only for user-level personalization.

### 2. `memory_record`

This is the new scoped durable-memory table in `db/schema/memory.ts`.

Fields:
- `id`
- `scopeType`
- `scopeId`
- `memoryType`
- `status`
- `title`
- `content`
- `summary`
- `category`
- `sourceType`
- `sourceThreadId`
- `createdByUserId`
- `approvedByUserId`
- `rejectedByUserId`
- `confidence`
- `metadata`
- `createdAt`
- `updatedAt`
- `approvedAt`
- `rejectedAt`
- `archivedAt`
- `lastReferencedAt`

Current usage:
- `scopeType = brand`
- `memoryType = shared_fact`

Current status rules:
- `pending_review` does not enter prompts
- `approved` may enter prompts
- `rejected` does not enter prompts
- `archived` does not enter prompts

### 3. `thread_working_memory`

This stores the persisted working state for a single chat thread.

Fields:
- `id`
- `threadId`
- `brandId`
- `summary`
- `currentObjective`
- `decisions`
- `openQuestions`
- `importantContext`
- `recentArtifacts`
- `lastMessageId`
- `refreshStatus`
- `createdAt`
- `updatedAt`
- `refreshedAt`
- `clearedAt`

---

## Prompt Behavior

Current prompt order:

1. base system prompt
2. conversation summary
3. thread working memory
4. grounding instruction
5. user profile memory
6. shared brand memory
7. brand context
8. skill blocks
9. tool guidance
10. quiz context

### User profile memory format

```xml
<user_context>
[preference] Prefers concise answers
[context] Runs an AI cowork platform for Thai users
</user_context>
```

### Shared brand memory format

```xml
<shared_memory scope="brand">
[voice] Brand voice: Keep the tone warm and practical
[process] Review rule: Campaign copy needs approval before publishing
</shared_memory>
```

### Thread working memory format

```xml
<thread_working_memory>
Summary: ...

Current objective: ...

Decisions:
- ...
</thread_working_memory>
```

---

## Runtime Flow

### Web chat flow

1. `app/api/chat/route.ts` loads preferences, thread, agent, and brand.
2. If profile-memory injection is enabled, it loads `getUserMemoryContext(userId)`.
3. It loads `buildThreadWorkingMemoryPromptBlock(threadId)`.
4. If there is an active brand, it loads `buildBrandMemoryPromptBlock(userId, brandId, lastUserPrompt)`.
5. All three memory layers are assembled into the system prompt.
6. After persistence completes, `refreshThreadWorkingMemoryFromMessages(...)` runs.
7. If profile-memory extraction is enabled, `extractAndStoreMemory(...)` runs in the background.

### LINE OA flow

Current LINE behavior:
- injects profile memory only
- uses the same assembly function
- passes shared memory and thread working memory as empty blocks today

### Shared brand memory flow

1. Brand owner or workspace admin creates or edits a record.
2. New and edited records enter `pending_review`.
3. Only after approval do they become eligible for prompt injection.
4. Retrieval is relevance-biased against the latest user prompt, with recency fallback.

### Thread working memory flow

1. Chat completes and messages are persisted.
2. `refreshThreadWorkingMemoryFromMessages(...)` summarizes current thread state into structured fields.
3. Subsequent turns inject that state through `<thread_working_memory>`.
4. Users can inspect, refresh, or clear the stored object from the chat UI.

---

## Permissions

### Shared brand memory

Read access:
- brand owner
- users with `brand_share`
- workspace members

Write and approval access:
- brand owner
- `workspace_member.role = 'admin'`

### Thread working memory

Access is restricted to the owning chat-thread user.

---

## User-Facing Surfaces

### Settings memory section

Current role:
- manage profile memory only

### Brand editor memory tab

Current role:
- list approved, pending, rejected, and archived brand memory
- create, edit, approve, reject, archive, restore, and delete when permitted
- read-only for non-admin collaborators

### Chat working-memory sheet

Current role:
- inspect stored thread working memory
- refresh it manually
- clear it

---

## Important Behavioral Notes

### 1. Profile memory, shared memory, and working memory are intentionally separate

Do not collapse them into one table or one prompt block.

### 2. Shared memory is approval-gated

Manual creation alone is not enough for prompt injection. Status must be `approved`.

### 3. Editing an approved shared-memory record resets it to review

This keeps trust and prompt behavior aligned. Edited content does not stay live automatically.

### 4. Working memory is not a continuity archive

It is current-thread state, not a cross-thread searchable history layer.

### 5. Conversation summaries still exist

`lib/conversation-summary.ts` still compacts long threads for a single request.

That summary is different from persisted `thread_working_memory`.

---

## Current Strengths

The shipped design is strongest in these areas:
- clear separation of memory layers
- shared brand knowledge with explicit approval
- durable thread coherence without replaying the full transcript
- stable user continuity across web and LINE
- one canonical prompt assembly path

---

## Current Gaps

Still missing:
- `workspace` memory
- `project` memory
- continuity archive retrieval across threads
- vector or hybrid retrieval for larger shared memory sets
- autonomous agent-note write paths
- richer trust metadata such as extractor version and expiry

---

## Rules for Future Changes

### If you are changing profile memory

- update `lib/memory.ts`
- preserve linked-user and unlinked-LINE behavior
- keep preference handling consistent through `resolveMemoryPreferences(...)`

### If you are changing shared memory

- keep approval status explicit
- do not inject unapproved records
- keep business memory separate from brand-profile fields

### If you are changing working memory

- treat it as current-thread state only
- preserve the inspect / refresh / clear workflow
- do not silently turn it into a cross-thread archive

### If you need workspace or project scope

Add a new scoped-memory implementation on top of `memory_record`. Do not overload `user_memory`.
