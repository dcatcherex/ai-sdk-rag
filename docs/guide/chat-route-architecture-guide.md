# Chat Route Architecture Guide

> Audience: AI coders and developers working on `app/api/chat/route.ts` or anything that calls `prepareAgentRun`.
> Purpose: establish where logic belongs so the route stays readable and every channel behaves consistently.

---

## Core Rule

**The chat route is an orchestrator. It does not build logic — it sequences calls.**

Each stage resolves one concern and passes the result forward. If you are writing conditional logic in the route that inspects model IDs, tool names, or message content, that logic belongs somewhere else.

---

## The Single `prepareAgentRun` Call

`prepareAgentRun()` in `features/agents/server/run-service.ts` is the only place that resolves:

- Which model to use (routing)
- What the system prompt is (assembly)
- Which tools are active (tool composition)
- Credit cost

The route calls it **once** with a fully populated `channelContext` and reads the result. It does not call `prepareAgentRun` twice for "seed then real" — that pattern was removed because the seed run always returned `supportsTools: false`, silently breaking tool guidance injection.

```
// Correct
const preparedRun = await prepareAgentRun({ ..., policy: WEB_AGENT_RUN_POLICY, channelContext: { ... } });
const resolvedModel = preparedRun.modelId;

// Wrong — do not do this
const seed = await prepareAgentRun({ ..., policy: { ...WEB_AGENT_RUN_POLICY, allowTools: false } });
// ... then call prepareAgentRun again with "real" policy
```

### Why the seed pattern breaks things

`prepareAgentRun` computes `supportsTools = policy.allowTools && !toolDisabledModels.has(modelId)`.
With `allowTools: false`, `supportsTools` is always `false` regardless of the model.
Any block gated on that value will always be empty. The call is wasted work that introduces a subtle ordering bug.

---

## Routing, Audit, and Credit — After `prepareAgentRun`

The resolved model and credit cost come from `preparedRun`, not from a separate seed call. The canonical order is:

```
1. Resolve identity, prefs, agent, brand, skills  (parallel DB queries)
2. Build channelContext  (prompt blocks, image context, quiz state)
3. prepareAgentRun()  →  resolved model, system prompt, tools, credit cost
4. Start audit log  (startChatRun, updateChatRunRouting)
5. Credit check  (compare balance vs preparedRun.creditCost)
6. Stream  (streamText or image path)
7. onFinish  (persist, memory, audit completion)
```

Steps 4–5 must come after step 3 because they need the real model ID and credit cost.

---

## Tool Guidance: Description, Not System Prompt

When a tool needs the model to call it reliably, **the tool description is the right place for that instruction** — not a system prompt block built in the route.

### The wrong pattern

```typescript
// route.ts — do not add this kind of thing
const myToolBlock = myToolEnabled && messageIsRelevant
  ? '\nIMPORTANT: When the user asks for X, you MUST call my_tool...'
  : '';
```

Problems:
- Requires keyword detection in the route to decide when to inject
- If the regex misses a case, the tool is silently skipped
- Adds a route-level variable for every tool that needs reinforcement
- Token cost on every relevant request

### The right pattern

Add the prohibition directly to the tool description in `agent.ts`:

```typescript
// features/my-tool/agent.ts
my_tool: tool({
  description:
    'Do X. Use this when the user asks for Y or Z. ' +
    'Never produce X as plain text — always call this tool.',
  ...
})
```

The model reads tool descriptions before deciding whether to call a tool. A clear "never freehand" instruction in the description is more reliable than a keyword-triggered system prompt block, and it fires correctly even when the route does not detect a relevant keyword.

### When a system prompt block is still appropriate

A block is appropriate only when it carries **dynamic runtime state** that cannot live in a static description:

| Block | Why it belongs in the prompt |
|-------|------------------------------|
| `quizContextBlock` | Carries live quiz state (answered questions, scores, completion status) — changes per request |
| `threadWorkingMemoryBlock` | Carries thread-specific memory extracted from prior turns |
| `sharedMemoryBlock` | Carries brand-scoped memory |
| Image reference blocks | Lists actual image URLs from the current thread |

Static usage instructions do not belong in prompt blocks. If you find yourself writing `supportsTools && toolEnabled && messageIsRelevant ? '...' : ''`, move it to the tool description.

---

## `supportsTools` Gating Belongs Inside `prepareAgentRun`

The route does not need to know `supportsTools`. If a prompt block should only appear when tools are active, gate it inside `buildAgentRunSystemPrompt` in `run-service.ts` using the internally computed `supportsTools`:

```typescript
// run-service.ts — correct place for tool gating
quizContextBlock: supportsTools ? (channelContext.quizContextBlock ?? '') : '',
```

The route passes the block unconditionally. `prepareAgentRun` decides whether to include it based on the actual model's capabilities.

---

## The `onFinish` Closure

The `onFinish` callback in both the text and image paths captures variables from the outer request scope. Collect those variables into a single object immediately before the stream call so the closure is easy to audit:

```typescript
const finishCtx = {
  threadId,
  userId: isGuest ? null : effectiveUserId,
  guestSessionId: isGuest ? guestSessionId : null,
  currentTitle,
  resolvedModel,
  creditCost,
  brandId: activeBrand?.id ?? null,
  userPrefs,
  memoryContext,
  lastUserPrompt,
  currentChatRunId,
};

return result.toUIMessageStreamResponse({
  onFinish: async ({ messages }) => {
    // read only from finishCtx — no outer scope variables
  },
});
```

This makes debugging persistence failures fast: all state `onFinish` needs is in one object visible right above the call.

---

## Where Logic Lives — Decision Table

| Concern | Belongs in |
|---------|-----------|
| Model routing (which model to use) | `prepareAgentRun` → `getModelByIntent` |
| System prompt assembly | `prepareAgentRun` → `buildAgentRunSystemPrompt` |
| Tool composition | `prepareAgentRun` → `buildToolSet` / `createAgentTools` |
| Skill activation | `prepareAgentRun` → `resolveAgentSkillRuntime` |
| Credit cost | `prepareAgentRun` → `getCreditCost` |
| `supportsTools` gating of prompt blocks | `prepareAgentRun` (not the route) |
| "Never freehand" tool instructions | Tool `description` in `agent.ts` |
| Static tool usage guidance | Tool `description` in `agent.ts` |
| Dynamic runtime state (quiz state, image URLs, thread memory) | `channelContext` block, passed to `prepareAgentRun` |
| Audit log start / routing metadata | Route, after `prepareAgentRun` returns |
| Credit check | Route, after `prepareAgentRun` returns |
| Persistence, memory extraction | `onFinish` callback, via `finishCtx` |

---

## Adding a New Tool — Checklist

See `CLAUDE.md` for the 9-step tool scaffold. For tool guidance specifically:

1. Write the tool description in `agent.ts` to be self-contained.
   - Include when to call it.
   - Include a "never freehand" prohibition if the model might satisfy the intent with plain text.
   - Include error-handling guidance ("if this tool fails, explain the error and ask only for the missing input").
2. Do **not** add a corresponding system prompt block in `route.ts`.
3. Do **not** add a keyword regex in `route.ts` to detect when the tool is relevant.
4. If the tool needs dynamic per-request state (not static instructions), add a `channelContext` block and gate it by `supportsTools` inside `buildAgentRunSystemPrompt`.

---

## Adding a New Prompt Block

If you need to inject new context into the system prompt:

1. Add the block builder in the appropriate feature service (not inline in the route).
2. Pass the result in `channelContext` when calling `prepareAgentRun`.
3. Add the key to `PreparedAgentRunChannelContext` in `run-service.ts`.
4. Add the key to `buildAgentRunSystemPrompt`'s parameter type.
5. Decide where it appears in the 14-block assembly order in `features/chat/server/prompt-assembly.ts`.
6. If the block should only appear when tools are active, gate it with `supportsTools` inside `buildAgentRunSystemPrompt` — not in the route.

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Orchestrator — sequences calls, no business logic |
| `features/agents/server/run-service.ts` | `prepareAgentRun` — single preparation entry point |
| `features/agents/server/channel-policies.ts` | Per-channel policy constants (`WEB_AGENT_RUN_POLICY`, etc.) |
| `features/chat/server/prompt-assembly.ts` | `buildAgentRunSystemPrompt` — 14-block assembly order |
| `features/chat/server/routing.ts` | `getModelByIntent` — model selection heuristics |
| `features/agents/server/runtime.ts` | Skill/brand/tool resolution helpers |
| `lib/tools/index.ts` | `buildToolSet` — assembles tool set for non-agent paths |
