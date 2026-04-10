# Prompt Architecture

This document describes how Vaja AI assembles the system prompt for chat requests today.

Read this before changing anything related to:
- system prompt construction in `app/api/chat/route.ts`
- memory injection or extraction in `lib/memory.ts`
- shared memory or working-memory injection in `features/memory/service.ts`
- tool guidance blocks in `app/api/chat/route.ts`
- the assembly module in `features/chat/server/prompt-assembly.ts`

Related documents:
- `docs/memory-implementation.md` - shipped memory data model and runtime behavior
- `docs/memory-recommendation.md` - longer-term layered memory roadmap

---

## Quick Reference

The final system prompt is built by `assembleSystemPrompt()` in `features/chat/server/prompt-assembly.ts`.

```
1  Base system prompt         (agent prompt or default assistant prompt)
2  Conversation summary       (compacted earlier turns, when thread is long)
3  Thread working memory      (<thread_working_memory> block)
4  Grounding instruction      (only when RAG documents are selected)
5  User profile memory        (<user_context> block)
6  Shared scoped memory       (<shared_memory> block, currently brand-scoped)
7  Brand context              (<brand_context> block)
8  Skill catalog              (<available_skills>)
9  Active skills              (<active_skills>)
10 Skill resources            (<skill_resources>)
11 Tool guidance              (exam prep, certificate)
12 Feature blocks             (quiz context)
```

Current scope rules:
- `user profile memory` is individual and durable
- `thread working memory` is current-thread state and durable
- `shared scoped memory` is currently `brand` memory only
- `workspace` and `project` memory belong in the same slot later, but are not shipped yet

---

## Canonical Files

| File | Role |
|------|------|
| `features/chat/server/prompt-assembly.ts` | Single assembly function and final block order |
| `app/api/chat/route.ts` | Main web-chat orchestrator |
| `features/line-oa/webhook/events/message.ts` | LINE prompt assembly path |
| `lib/memory.ts` | User profile memory retrieval, rendering, extraction, preferences |
| `features/memory/service.ts` | Shared brand memory retrieval and thread working-memory generation |
| `lib/conversation-summary.ts` | Long-thread compaction before assembly |
| `lib/prompt.ts` | Default system prompt and template substitution |
| `features/brands/service.ts` | `buildBrandBlock()` |
| `features/skills/service.ts` | Skill runtime blocks |

---

## Assembly Module

### `features/chat/server/prompt-assembly.ts`

`assembleSystemPrompt(input: SystemPromptInput): string`

The assembly module accepts pre-built blocks and concatenates them in the canonical order. It owns ordering, not retrieval logic.

Current input shape:

```typescript
const effectiveSystemPrompt = assembleSystemPrompt({
  base: baseSystemPrompt,
  conversationSummaryBlock,
  threadWorkingMemoryBlock,
  isGrounded,
  activeBrand,
  memoryContext,
  sharedMemoryBlock,
  skillRuntime,
  examPrepBlock: examPrepToolInstructions,
  certBlock: certificateToolInstructions,
  quizContextBlock: supportsTools ? quizContextBlock : '',
});
```

Convention:
- every non-base block is either `''` or already formatted as a self-contained block
- the assembler adds only the minimum `\n\n` wrapper needed around raw memory blocks
- do not append more prompt text after the assembly call

If you add a new prompt block:
1. Compute it in the route or service layer.
2. Add a field to `SystemPromptInput`.
3. Insert it in `assembleSystemPrompt()` in the correct position.
4. Update this document.

---

## Request Lifecycle in `app/api/chat/route.ts`

```
Stage 1  auth + body parse
Stage 2  DB queries: user, thread, prefs, balance, agent
Stage 3  profile memory + active brand
Stage 4  thread working memory + shared brand memory
Stage 5  skill runtime
Stage 6  base system prompt + template substitution
Stage 7  model routing
Stage 8  credit check
Stage 9  tool set assembly
Stage 10 tool guidance blocks
Stage 11 quiz context block
Stage 12 prompt enhancement
Stage 13 conversation summarization
Stage 14 assembleSystemPrompt()
Stage 15 streamText() or generateImage()
Stage 16 onFinish: persist, refresh thread working memory, follow-up suggestions, profile-memory extraction
```

Order matters:
- enhancement happens before summarization
- summarization happens before assembly
- persisted thread working memory is loaded before the model call and refreshed after persistence

---

## Memory Blocks

### 1. User profile memory

Source:
- `getUserMemoryContext(userId)` in `lib/memory.ts`

Format:

```xml
<user_context>
[preference] Prefers concise answers
[context] Runs a Thai AI startup
</user_context>
```

Properties:
- user-scoped
- compact prompt injection
- gated by `memoryEnabled` + `memoryInjectEnabled`
- extracted after the reply by `extractAndStoreMemory(...)` when enabled

### 2. Thread working memory

Source:
- `buildThreadWorkingMemoryPromptBlock(threadId)` in `features/memory/service.ts`

Format:

```xml
<thread_working_memory>
Summary: ...

Current objective: ...

Decisions:
- ...

Open questions:
- ...
</thread_working_memory>
```

Properties:
- thread-scoped and persisted in `thread_working_memory`
- system-managed, not user-edited
- refreshed after chat persistence
- intended to keep long-running threads coherent without replaying full transcript history

### 3. Shared scoped memory

Source:
- `buildBrandMemoryPromptBlock(userId, brandId, query)` in `features/memory/service.ts`

Format:

```xml
<shared_memory scope="brand">
[voice] Brand voice rule: Keep wording warm, practical, and direct
[process] Approval rule: Social copy needs brand review before publishing
</shared_memory>
```

Current shipped behavior:
- currently `brand` scope only
- only `approved` records are eligible for injection
- selection is relevance-biased against the latest user prompt, with recency fallback
- prompt-injected under a character budget
- pending, rejected, and archived records never enter the prompt

### 4. Brand context

Source:
- `buildBrandBlock(activeBrand)` in `features/brands/service.ts`

Purpose:
- structured profile of the active brand
- distinct from shared memory

Rule of thumb:
- put durable facts, constraints, and reusable operating knowledge in `shared memory`
- keep descriptive brand profile data in `brand context`

---

## Workspace / Project Memory

This document should cover workspace / project memory from the prompt-runtime angle.

When those scopes ship, they should use the same prompt slot as shared brand memory:
- after `user profile memory`
- before `brand context`

Expected runtime rules:
- high-trust approved records may be injected directly when small
- larger scoped memory should be selected by relevance, not dumped wholesale
- status gating should stay strict: only approved active memory enters the prompt

What does not belong here:
- schema design
- approval workflow details
- long-term roadmap tradeoffs

Those stay in `docs/memory-recommendation.md` and `docs/memory-implementation.md`.

---

## LINE Prompt Path

LINE also uses `assembleSystemPrompt()`.

Current LINE behavior:
- passes LINE-specific formatting instructions through the `base` field
- injects user profile memory into `memoryContext`
- passes `threadWorkingMemoryBlock` and `sharedMemoryBlock` as empty strings today
- passes non-applicable skill and tool-guidance blocks as empty strings

This keeps the assembly path shared while allowing LINE to opt into more memory layers later.

---

## Tool Guidance Gating

Exam prep and certificate guidance are still injected only when relevant. They stay late in the prompt so memory and brand context land first.

Rules for new tool-guidance blocks:
1. Define the instruction in `app/api/chat/route.ts`.
2. Gate it with explicit relevance logic.
3. Pass it into `assembleSystemPrompt()`.
4. Document the new block here.

Do not put tool guidance inside tool services or agent adapters.

---

## What Not To Do

- Do not append extra prompt text after `assembleSystemPrompt()`.
- Do not collapse user profile memory, thread working memory, and shared memory into one block.
- Do not inject pending or rejected shared memory.
- Do not treat conversation summarization as the same thing as persisted working memory.
- Do not create a second assembly path for a special case if a typed block can solve it.

---

## Current Gaps

Still deferred:
- `workspace` memory
- `project` memory
- continuity archive retrieval across threads
- default prompt injection for agent-authored notes
- vector or hybrid retrieval for larger shared-memory stores
