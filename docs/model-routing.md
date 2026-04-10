# Model Routing

This document describes how Vaja AI selects an AI model for every request.

Read this before changing anything related to:
- intent detection or model selection in `features/chat/server/routing.ts`
- model definitions and capabilities in `lib/ai.ts`
- how routing is called in `app/api/chat/route.ts`
- prompt enhancement gating in `app/api/compare/route.ts`
- vision model resolution in `features/line-oa/webhook/events/message.ts`

---

## Quick Reference

```
Every chat/LINE request
        │
        ├─ model manually selected? ──────────────────── use that model
        │
        └─ auto-routing (getModelByIntent)
                │
                ├─ wantsImage?   → pickByCapability('image gen')
                ├─ wantsWeb?     → pickByCapability('web search')
                ├─ wantsCode?    → selectTextModel(preferStrong)
                ├─ wantsReasoning? → selectTextModel(preferStrong)
                ├─ isSimpleQuery?  → selectTextModel(preferCheap)
                └─ general chat   → selectTextModel(default)
```

`selectTextModel` ranking (applied inside every branch):

```
1. Context filter  — exclude models whose window < estimatedContextTokens / 0.8
2. Tier filter     — preferStrong: keep isStrongModel() only
                     preferCheap:  keep !isStrongModel() only
                     (both fall back to full set if no candidate passes)
3. Sort            — user score descending → inputCost ascending
```

---

## Canonical Files

| File | Role |
|------|------|
| `lib/ai.ts` | Model registry — `availableModels`, `Capability` type, `isStrongModel()` |
| `lib/model-scores.ts` | User feedback store — `getUserModelScores()`, `updateModelScore()` |
| `features/chat/server/routing.ts` | All routing logic — `getModelByIntent()`, `selectTextModel()`, `modelSupportsCapability()` |
| `app/api/chat/route.ts` | Chat call site — computes `estimatedContextTokens`, calls `getModelByIntent` |
| `app/api/compare/route.ts` | Compare call site — applies `isStrongModel` gate before `enhancePrompt` |
| `features/line-oa/webhook/events/message.ts` | LINE call site — uses `modelSupportsCapability(id, 'vision')` for vision fallback |
| `features/models/components/models-table.tsx` | UI display — `capabilityIcons` must mirror every `Capability` value |

---

## Model Registry (`lib/ai.ts`)

### `ModelOption` fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `string` | Provider-prefixed ID, e.g. `"google/gemini-2.5-flash-lite"` |
| `capabilities` | `Capability[]` | What the model can do — drives all routing decisions |
| `inputCost` | `number` | USD per 1M input tokens — used as capability proxy by `isStrongModel()` and as tiebreaker in ranking |
| `outputCost` | `number` | USD per 1M output tokens |
| `context` | `string` | Context window size, e.g. `"1m"`, `"128k"`, `"66k"` — parsed by `parseContextTokens()` |
| `latency` | `number` | Time-to-first-token in seconds — informational only, not used in routing today |
| `throughput` | `number` | Tokens per second — informational only |
| `gateway` | `Gateway` | Deployment gateway — currently all `"vercel"` |

### `Capability` values

| Value | Meaning | Who uses it |
|-------|---------|-------------|
| `"text"` | Generates text responses | All text routing branches |
| `"vision"` | Accepts image input | LINE `resolveVisionModel()` |
| `"image gen"` | Generates images | `wantsImage` branch, `isImageOnlyModel()` |
| `"web search"` | Has grounded web search | `wantsWeb` branch |
| `"implicit caching"` | Provider-side KV cache | Informational only |
| `"explicit caching"` | Prompt caching API | Informational only |
| `"embeddings"` | Produces embeddings | Informational only |
| `"video gen"` | Generates video | Informational only |

### `isStrongModel(modelId)`

Returns `true` when `inputCost >= 0.50` USD per 1M tokens. This is used as a proxy for capability tier:

- **Strong** (≥ $0.50): eligible for code, reasoning, and `preferStrong` routing; skips `enhancePrompt`
- **Cheap** (< $0.50): eligible for `preferCheap` / simple query routing

The threshold is not a constant — it is derived from `inputCost` in `availableModels`. Keep model costs accurate to keep this proxy correct.

---

## Routing Logic (`features/chat/server/routing.ts`)

### Intent detection order

Intents are evaluated in priority order. The first match wins.

```
1. wantsImage      → image gen
2. wantsWeb        → web search
3. wantsCode       → strong text model
4. wantsReasoning  → strong text model
5. isSimpleQuery   → cheap text model
6. (none)          → general chat text model
```

### Intent keywords

**`wantsImage`** — triggers image gen routing:
```
starts with: "create image", "generate image"
contains: "image of", "draw ", "illustration"
```

**`wantsWeb`** — triggers web search routing:
```
useWebSearch flag (explicit toggle from client)
contains: "search", "latest", "news", "web"
```
Intentionally excluded: `"source"` — too many false positives ("source of this claim").

**`wantsCode`** — triggers strong-model routing:
```
contains: "code", "coding", "typescript", "javascript", "python",
          "refactor", "debug", "implement", "class"
```
Intentionally excluded: `"api"`, `"function"` — both appear frequently in non-coding contexts.

**`wantsReasoning`** — triggers strong-model routing:
```
contains: "analy", "reason", "compare", "evaluate",
          "diagnose", "pros and cons", "tradeoff"
```

**`isSimpleQuery`** — triggers cheap-model routing. All conditions must be true:
```
wordCount < 20
AND hasAgent == false
AND hasActiveSkills == false
AND messageCount <= 2
```
The agent/skills/history gates prevent under-routing expensive tasks that happen to have short prompts (e.g. "Fix this deadlock").

### `selectTextModel` strategy flags

| Flag | Effect on candidate set |
|------|------------------------|
| `preferStrong: true` | Filter to `isStrongModel()` models; fall back to all if none enabled |
| `preferCheap: true` | Filter to `!isStrongModel()` models; fall back to all if none enabled |
| (neither) | All text-capable models |

After candidate filtering, context filtering runs, then ranking: user score → cost ascending.

### Context filtering (80% rule)

Before ranking, models whose declared context window is too small are excluded:

```
estimatedContextTokens < parseContextTokens(model.context) * 0.8
```

If no model passes this filter, the full set is kept — routing degrades gracefully rather than failing.

`estimatedContextTokens` is computed in `app/api/chat/route.ts` before calling `getModelByIntent`:

```typescript
const estimatedContextTokens =
  messages.reduce((sum, m) => sum + Math.ceil(JSON.stringify(m.parts ?? []).length / 4), 0) +
  Math.ceil(
    (skillRuntime.activeSkillsBlock.length +
      skillRuntime.skillResourcesBlock.length +
      skillRuntime.catalogBlock.length) / 4
  ) +
  3000; // system prompt + memory + tool definitions overhead
```

---

## User Score Feedback

Users thumbs-up/thumbs-down individual model responses. Scores are stored in `userModelScore` table, keyed by `userId + modelId + persona`.

`ModelScoreMap` is a `Map<string, number>` where keys are `"${modelId}::${persona}"`.

Scores influence routing through `getUserScore()` inside `selectTextModel()`: for a given model, all matching keys are summed. A model with positive accumulated scores ranks higher than one with no reactions, all else being equal.

Scores are deliberately a tiebreaker, not the primary signal. The tier filter (`preferStrong` / `preferCheap`) runs first. A highly-scored cheap model does not override a code intent that requires a strong model.

---

## Routing in Other Contexts

### LINE Webhook (`features/line-oa/webhook/events/message.ts`)

LINE agents have a saved `modelId` from `agentRow`. There is no auto-routing for LINE text messages — the agent's assigned model is used directly.

Vision fallback: when a LINE user sends an image, `resolveVisionModel(modelId)` checks `modelSupportsCapability(modelId, 'vision')`. If the agent's model does not support vision, it falls back to `chatModel` (Gemini) for that turn only.

Image generation: LINE uses a fixed model `LINE_IMAGE_MODEL = 'openai/gpt-image-1.5'` for image generation requests, independent of the agent's model.

### Compare Route (`app/api/compare/route.ts`)

Model is explicitly provided by the client — compare mode is always manual selection, never auto-routed. `enhancePrompt` is skipped for strong models using the same `isStrongModel(modelId)` gate as the main chat route.

---

## Common Maintenance Tasks

### Add a new model

1. Add an entry to `availableModels` in `lib/ai.ts`. Include accurate `inputCost`, `outputCost`, `context`, and `capabilities`.
2. If the model supports vision input, add `"vision"` to its capabilities.
3. If the model supports image generation, add `"image gen"` — and set `capabilities` to only `["image gen"]` if it is image-only.
4. No changes needed to `routing.ts` — model selection is data-driven.

### Remove a model

1. Delete its entry from `availableModels` in `lib/ai.ts`.
2. Grep for the model ID across the codebase: `grep -r "model-id-here" --include="*.ts"`. Some features (LINE webhook, agent defaults) may reference model IDs directly.
3. Check `toolDisabledModels` in `routing.ts` — remove the entry if it's there.

### Add a new capability

1. Add the value to the `Capability` union in `lib/ai.ts`.
2. Add it to `capabilityIcons` in `features/models/components/models-table.tsx` — TypeScript will error if you forget this (`Record<Capability, ...>` is exhaustive).
3. Add the capability to relevant models in `availableModels`.
4. If routing should dispatch based on this capability, add a new intent branch in `getModelByIntent()` using `pickByCapability('your-capability')`.

### Add a model to the tool-disabled list

Some models cannot make tool calls (e.g. image-only models):

```typescript
// features/chat/server/routing.ts
export const toolDisabledModels = new Set([
  'google/gemini-2.5-flash-image',
  'your-new-model-id',
]);
```

### Adjust intent keywords

Keywords are in `getModelByIntent()` in `routing.ts`. Before adding a keyword, ask:

> Does this word appear in everyday sentences unrelated to this intent?

- `"api"` → NO (too many false positives — not in `wantsCode`)
- `"typescript"` → YES (safe — add to `wantsCode`)
- `"source"` → NO (not in `wantsWeb` — "source of this claim" would misroute)

Prefer phrase-based matches (`lower.startsWith('...')`, `lower.includes('... ')` with a trailing space) over single bare words.

### Adjust the `isSimpleQuery` threshold

The current threshold is `wordCount < 20 AND messageCount <= 2`. These numbers are conservative on purpose. If you see strong models being used for trivial greetings late in a conversation, raise `messageCount`. If short-but-hard queries are misrouted to cheap models, lower `wordCount` or tighten the intent detection to catch them earlier.

The agent/skills gates are intentional — do not remove them without re-evaluating the simple-query path for agent workflows.

### Adjust the `isStrongModel` threshold

Current threshold: `inputCost >= 0.50` USD per 1M input tokens.

This is a deliberate proxy, not a hard rule. If a new cheap model is capable enough to handle code/reasoning, either:
- Raise its `inputCost` to reflect its real tier (preferred), or
- Replace the cost-based proxy with an explicit `tier` field on `ModelOption`

Do not hardcode model IDs in routing logic. The proxy exists precisely to avoid that.

### Adjust context window safety margin

The 80% safety margin is in `selectTextModel`:

```typescript
estimatedContextTokens < parseContextTokens(m.context) * 0.8
```

If you add very long system prompts or large skill bundles, lower this multiplier (e.g. `0.6`). If you find capable models being incorrectly excluded, check whether the `estimatedContextTokens` calculation in `route.ts` is over-counting.

---

## What Not to Do

- **Do not hardcode model IDs in routing logic.** Use capability flags or `isStrongModel()`. Model IDs change when providers release new versions.
- **Do not add a new `Capability` without updating `capabilityIcons` in `models-table.tsx`.** TypeScript enforces this with an exhaustive `Record<Capability, ...>` — the build will fail, but the error message may not be obvious.
- **Do not add broad keywords to intent detection.** `"class"`, `"implement"` are borderline acceptable. Single words like `"api"`, `"function"`, `"source"` have too many false positives.
- **Do not duplicate image-intent detection in the LINE handler.** The LINE handler (`message.ts`) delegates vision capability checks to `modelSupportsCapability()`. If you add Thai image-intent keywords, add them only in `message.ts` (LINE-specific). English keywords belong in `routing.ts`.
- **Do not bypass the `isStrongModel` gate in `enhancePrompt`.** Both `chat/route.ts` and `compare/route.ts` apply it. A third call site should too.
