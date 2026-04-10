# Prompt Architecture

This document describes how Vaja AI assembles the system prompt for every chat request.

Read this before changing anything related to:
- system prompt construction in `app/api/chat/route.ts`
- memory injection or extraction in `lib/memory.ts`
- tool guidance blocks in `app/api/chat/route.ts`
- the assembly module in `features/chat/server/prompt-assembly.ts`

Related documents:
- `docs/memory-implementation.md` — memory data model, APIs, and preference flags
- `docs/memory-recommendation.md` — layered memory architecture roadmap

---

## Quick Reference

The final system prompt is built by `assembleSystemPrompt()` in `features/chat/server/prompt-assembly.ts`.

```
1  Base system prompt         (agent | default general assistant)
2  Conversation summary       (compacted earlier turns)
3  Grounding instruction      (only when RAG documents are selected)
4  User profile memory        (<user_context> block)
5  Brand context              (<brand_context> block)
6  Skill catalog              (<available_skills> — model-discoverable skills)
7  Active skills              (<active_skills> — triggered skill instructions)
8  Skill resources            (<skill_resources> — reference files from active skills)
9  Tool guidance              (exam prep, certificate — injected only when relevant)
10 Feature blocks             (quiz context — only when quizContext is in the request)
```

---

## Canonical Files

| File | Role |
|------|------|
| `features/chat/server/prompt-assembly.ts` | Single assembly function — the only place that decides block order |
| `app/api/chat/route.ts` | Orchestrator — gathers data, calls assembly, runs streamText |
| `lib/memory.ts` | Memory retrieval, rendering, extraction, and preference helpers |
| `lib/prompt.ts` | Default system prompt (`DEFAULT_SYSTEM_PROMPT`), template substitution |
| `lib/prompt-enhance.ts` | Optional user message rewriter (skipped for strong models) |
| `lib/conversation-summary.ts` | Compaction — summarises long threads before assembly |
| `lib/ai.ts` | Model registry, `isStrongModel()` |
| `features/skills/server/activation.ts` | Skill trigger detection, catalog and active-skills block builders |
| `features/brands/service.ts` | `buildBrandBlock()` |

---

## Assembly Module

### `features/chat/server/prompt-assembly.ts`

`assembleSystemPrompt(input: SystemPromptInput): string`

Takes typed, pre-built blocks and concatenates them in the correct order. It owns no business logic — all computation happens in the route before the call.

```typescript
const effectiveSystemPrompt = assembleSystemPrompt({
  base: baseSystemPrompt,
  conversationSummaryBlock,    // '' or '\n\n<conversation_summary>...'
  isGrounded,
  activeBrand,
  memoryContext,               // '' or '<user_context>...'
  skillRuntime,                // { catalogBlock, activeSkillsBlock, skillResourcesBlock }
  examPrepBlock: examPrepToolInstructions,
  certBlock: certificateToolInstructions,
  quizContextBlock: supportsTools ? quizContextBlock : '',
});
```

**Convention:** every non-base block is either `''` or already carries its own `'\n\n'` / `'\n'` separator. The assembler does not add spacing — it concatenates as-is.

**Do not** add new blocks by concatenating onto `effectiveSystemPrompt` after the assembly call. Add a new field to `SystemPromptInput` and handle it inside `assembleSystemPrompt`.

---

## Request Lifecycle in `app/api/chat/route.ts`

```
Stage 1  auth + body parse (parallel)
Stage 2  DB queries: user, thread, prefs, balance, agent (parallel)
Stage 3  memory + brand (parallel)
Stage 4  skill runtime: detect triggers, model discovery, load resources
Stage 5  base system prompt + template substitution
Stage 6  model routing
Stage 7  credit check
Stage 8  tool set assembly
Stage 9  tool guidance blocks (exam prep, certificate) — gated by message relevance
Stage 10 quiz context block
Stage 11 prompt enhancement — skipped for strong frontier models
Stage 12 conversation summarisation — only on long threads (> 20 messages)
Stage 13 assembleSystemPrompt() — produces effectiveSystemPrompt
Stage 14 streamText() or generateImage()
Stage 15 onFinish: persist, follow-up suggestions, memory extraction
```

The ordering of stages 11–13 matters. Enhancement rewrites the user message before summarisation sees it. Summarisation must complete before assembly so the summary lands in position 2.

---

## Base System Prompt

The base prompt is resolved in a single priority chain:

```
1. Agent system prompt — if agentId is in the request, the agent's own prompt is used
2. DEFAULT_SYSTEM_PROMPT — exported from lib/prompt.ts (general assistant)
```

**There are no built-in personas.** Domain-specific behaviour (coding, research, tutoring, etc.) is delivered through agent system prompts and skills, not a persona layer.

**Template substitution** — `resolveSystemPromptTemplate(rawSystemPrompt)` runs on the resolved base prompt regardless of source. It replaces `{CURRENT_DATE}`, `{THAI_SEASON}`, and `{USER_PROVINCE}` placeholders at request time.

---

## Memory System

### Three exported functions

```typescript
// 1. Raw DB fetch — newest first, up to MAX_FACTS_PER_USER (50)
getUserMemoryFacts(userId: string): Promise<MemoryFact[]>

// 2. Pure rendering — applies token budget and per-category cap
renderUserMemoryBlock(facts, options?): string

// 3. Convenience wrapper used by all entry points
getUserMemoryContext(userId: string): Promise<string>
```

Call `getUserMemoryContext` everywhere memory is needed. Use `getUserMemoryFacts` + `renderUserMemoryBlock` directly only if you need a different budget or format (e.g. settings UI, future workspace memory).

### Injection budget

`renderUserMemoryBlock` applies two guards in a single pass over the facts array:

1. **Per-category cap** — default 8 facts per category. Prevents one category dominating the block.
2. **Character budget** — default 2400 chars (~600 tokens at 4 chars/token). Hard ceiling.

Facts are newest-first from the DB, so recent facts survive when the budget is tight.

The storage limit (`MAX_FACTS_PER_USER = 50`) in `extractAndStoreMemory` is a separate concern — it controls how many facts are kept in the DB, not how many reach the prompt.

### Preference flags

Three flags on `userPreferences` control memory behaviour:

| Flag | Meaning |
|------|---------|
| `memoryEnabled` | Master switch — overrides both below when false |
| `memoryInjectEnabled` | Allow injection into system prompt |
| `memoryExtractEnabled` | Allow background extraction after response |

**All three default to `true` when no preferences row exists.**

Use `resolveMemoryPreferences(row)` from `lib/memory.ts` at every entry point. Do not replicate the default logic inline.

```typescript
const { shouldInject, shouldExtract } = resolveMemoryPreferences(prefsRows[0] ?? null);
```

### Entry points and their current status

| Entry point | Prefs respected | Notes |
|-------------|----------------|-------|
| `app/api/chat/route.ts` | Yes | All three flags checked |
| `features/line-oa/webhook/events/message.ts` | Yes | Prefs loaded when linkedUser exists |
| `app/api/compare/route.ts` | Yes | Only inject flag applies (no extraction) |

If you add a new entry point that uses memory, call `resolveMemoryPreferences` before calling `getUserMemoryContext` or `extractAndStoreMemory`.

---

## Skill Blocks

Three blocks come from `resolveSkillRuntimeContext()` in `features/skills/server/activation.ts`:

| Block | Tag | Content |
|-------|-----|---------|
| `catalogBlock` | `<available_skills>` | Names + descriptions of model-discoverable skills. Listed so the LLM knows what is available even before activation. |
| `activeSkillsBlock` | `<active_skills>` | Full instructions from triggered and model-discovered skills. |
| `skillResourcesBlock` | `<skill_resources>` | Up to 2 scored reference files per activated skill (3 if explicitly referenced in the skill instructions). |

All three are `''` when no agent is active or no skills are attached.

The resource loader fetches skill files from the DB but injects only a scored subset — it does not dump all files. See `features/skills/server/resources.ts` for the scoring logic.

---

## Tool Guidance Gating

Exam prep and certificate instructions are long (~200 tokens each). They are injected **only when the message is relevant**, not on every request.

### Exam prep gate

```typescript
const examRelevant =
  !!quizContext ||
  /quiz|exam|practice|study|flashcard|flash card|grade|diagnos|learning gap|weak area|revision|ทบทวน|ข้อสอบ|แบบฝึกหัด/i
    .test(lastUserPrompt ?? '');
```

`quizContext` is always treated as exam-relevant because the user is mid-quiz.

### Certificate gate

```typescript
const certRelevant =
  /certif|template|recipient|generate cert|preview cert|ใบรับรอง|ใบประกาศ|ใบวุฒิ/i
    .test(lastUserPrompt ?? '');
```

### Rules for adding guidance blocks for new tools

1. Define the tool guidance string in `app/api/chat/route.ts` near the other tool guidance blocks.
2. Write a relevance regex that covers the obvious trigger words in both English and Thai.
3. Gate the string on `supportsTools && toolEnabled && relevant`.
4. Pass the result into `assembleSystemPrompt` as a new field on `SystemPromptInput`.
5. Add the field to the type and to the concatenation inside `assembleSystemPrompt`.

Do not put tool guidance directly in service files or manifests — it belongs here in the assembly layer where all blocks are visible together.

---

## Prompt Enhancement

`enhancePrompt()` in `lib/prompt-enhance.ts` rewrites the user's last message with a fast Gemini call before it is sent to the main model. It is designed to add specificity to vague prompts.

### When it runs

Three conditions must all be true:

1. `userPrefs.promptEnhancementEnabled` is true (user preference, defaults to true)
2. `lastUserPrompt` is non-empty and meets the minimum length threshold (15 chars, 4 words — enforced inside `enhancePrompt`)
3. `!isStrongModel(resolvedModel)` — skipped for frontier models

### `isStrongModel(modelId)` in `lib/ai.ts`

Returns `true` when `inputCost >= $0.50 / 1M tokens` in `availableModels`. Uses cost as a proxy for capability — strong models can self-clarify without pre-processing.

**This check is automatic.** When you add or update a model's `inputCost` in `availableModels`, enhancement gating updates with no other changes needed.

Enhancement is skipped for strong models because:
- The downstream model handles vague prompts better than the enhancer model (Gemini Flash Lite)
- It eliminates a synchronous LLM call and ~100–300ms of latency
- The rewritten prompt is invisible to the user, which is confusing for capable models that handle the original well

### Compare route

`app/api/compare/route.ts` also uses `enhancePrompt`. It does not currently apply the `isStrongModel` gate. If latency becomes a concern there, the same pattern applies.

---

## Conversation Summarisation

`summarizeConversation()` in `lib/conversation-summary.ts` runs when `messages.length > SUMMARY_THRESHOLD` (currently 20 messages).

It keeps the last `MESSAGES_TO_KEEP` (currently 8) messages verbatim and compresses the rest into a max-300-word summary.

The summary block is passed as `conversationSummaryBlock` to `assembleSystemPrompt`, where it lands at **position 2** — after the base prompt, before grounding and memory. This placement ensures the model reads the historical context before it processes knowledge injections.

**Do not** append the summary after `effectiveSystemPrompt`. That places it at the tail, after tool guidance and skill resources, where it competes for attention with more recent injections.

---

## Adding a New Prompt Block

Checklist:

1. Compute the block in `app/api/chat/route.ts` as a string that is either `''` or starts with `'\n\n'`.
2. Add a new field to `SystemPromptInput` in `features/chat/server/prompt-assembly.ts`.
3. Place the field in the correct position inside the `return` statement of `assembleSystemPrompt`.
4. Pass the value from the route to the assembly call.
5. Update this document with the new block's position and gating logic.

---

## What NOT To Do

- Do not concatenate onto `effectiveSystemPrompt` after the `assembleSystemPrompt` call.
- Do not add tool-specific instructions directly inside tool `service.ts` or `agent.ts` files — they belong in the assembly layer.
- Do not inject memory without calling `resolveMemoryPreferences` first.
- Do not skip `resolveSystemPromptTemplate` for agent system prompts — agents go through it.
- Do not create a second assembly path for a special case. Add a field to `SystemPromptInput` instead.
- Do not raise `MAX_FACTS_PER_USER` without also reconsidering `INJECTION_MAX_CHARS` — the two limits are intentionally independent.
- Do not re-introduce a persona layer. Domain-specific behaviour belongs in agent system prompts and SKILL.md files.

---

## Known Gaps and Future Work

These are intentionally deferred. Do not implement without a plan.

### Workspace / project memory (Layer 2)

The current memory system is user-scoped. Agents and agent teams need shared memory scoped to a project, brand, or workspace. This is the highest-value next step in the memory roadmap.

See `docs/memory-recommendation.md`, Layer 2.

### Token-accurate budget

`renderUserMemoryBlock` uses a 4-chars-per-token estimate. For exact token counts, integrate a tokenizer (e.g. `tiktoken` for OpenAI-family models, Gemini's token counter). The current estimate is conservative and safe — exact counting can be added without changing the function signature.

### LINE OA memory consistency

Resolved. LINE now builds a `lineBase` prompt (agent system prompt + LINE-specific formatting instructions + group/user name context) and passes it through `assembleSystemPrompt` as the `base` field, with `memoryContext` wired to the same field used by web chat. Memory lands at position 4 in `<user_context>` format, identical to web chat. Non-applicable fields (grounding, skills, tool guidance) are passed as empty strings.

### Lazy skill resource loading

Currently all skill reference files for activated skills are pre-fetched and injected in bulk. A just-in-time approach — keeping lightweight file identifiers in context and fetching content via tool call — would reduce prompt size further, especially for skills with many reference files.
