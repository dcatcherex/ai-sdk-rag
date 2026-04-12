# Web Search & Research Capability — Developer & AI Coder Guide

This guide covers everything needed to implement real web search for the General Assistant agent: model-native grounding, Tavily tool integration, and the research-assistant skill.

Read this before touching `app/api/chat/route.ts`, `lib/tools/`, or any model initialization code.

---

## Table of Contents

1. [Why This Exists](#1-why-this-exists)
2. [Architecture Overview](#2-architecture-overview)
3. [Current State (Gap Analysis)](#3-current-state-gap-analysis)
4. [Layer 1 — Google Search Grounding (Gemini)](#4-layer-1--google-search-grounding-gemini)
5. [Layer 2 — Tavily Web Search Tool](#5-layer-2--tavily-web-search-tool)
6. [Layer 3 — Research Assistant Skill](#6-layer-3--research-assistant-skill)
7. [Wiring It All Together in the Chat Route](#7-wiring-it-all-together-in-the-chat-route)
8. [Model Capability Matrix](#8-model-capability-matrix)
9. [Environment Variables](#9-environment-variables)
10. [Implementation Checklist](#10-implementation-checklist)
11. [Common Mistakes & Gotchas](#11-common-mistakes--gotchas)
12. [Testing](#12-testing)

---

## 1. Why This Exists

Skills alone are not enough for real-work research. A skill injects static domain knowledge — it cannot fetch live data. When a user asks:

- "What is the price of cassava at Bangkok market today?"
- "Is this regulation still in effect?"
- "Compare the latest smartphones under 15,000 baht"

...the model answers from training data, which may be months or years stale. For a Thai SME owner relying on Vaja as a coworker, stale information is actively harmful.

The design principle: **skills shape how the AI researches; tools give it the ability to search; model grounding injects live results at zero extra cost where available.**

---

## 2. Architecture Overview

```
User message (useWebSearch flag or search intent detected)
        │
        ▼
routing.ts: getModelByIntent()
        │  wantsWeb = true → picks model with "web search" capability
        │  (Gemini → preferred, GPT-5.4 → fallback)
        ▼
app/api/chat/route.ts: resolveModelInstance()          ← NEW
        │
        ├── Gemini model + useWebSearch=true
        │       └── google(modelId, { useSearchGrounding: true })
        │               └── Grounding fetches Google results internally
        │                   Sources embedded in response metadata
        │
        └── Any other model (Claude, GPT, DeepSeek, etc.)
                └── streamText with web_search tool in toolset
                        └── AI calls web_search(query) explicitly
                                └── Tavily API returns results
                                └── AI synthesizes + cites

research-assistant SKILL.md (attached to General Assistant agent)
        └── Guides multi-query strategy, citation format,
            confidence flagging, Thai context awareness
```

### Why two layers instead of one?

- **Google grounding** is zero-cost, zero-latency overhead, and returns better results for Gemini. But it only works on Gemini models via `@ai-sdk/google`.
- **Tavily tool** works for all tool-capable models and gives the AI explicit control over what it searches and when — better for multi-hop research.
- They are not mutually exclusive. When both are active on a Gemini model, grounding handles background context and the tool handles explicit search calls.

---

## 3. Current State (Gap Analysis)

### What already works

| Feature | Status | Location |
|---|---|---|
| `useWebSearch` flag in request schema | ✅ Done | `features/chat/server/schema.ts` |
| Router picks web-capable model on `wantsWeb` | ✅ Done | `features/chat/server/routing.ts:177` |
| `"web search"` capability tagged on Gemini + GPT models | ✅ Done | `lib/ai.ts` |
| `useWebSearch` passed through to audit/logging | ✅ Done | `app/api/chat/route.ts` |
| Web search toggle in chat composer UI | ✅ Done | `features/chat/components/composer/chat-composer.tsx` |

### What is missing (this implementation adds)

| Feature | Status | What to build |
|---|---|---|
| Google Search grounding actually enabled | ❌ Missing | `resolveModelInstance()` in chat route |
| Tavily web_search tool | ❌ Missing | `lib/tools/web-search.ts` |
| `web_search` registered in buildToolSet | ❌ Missing | `lib/tools/index.ts` |
| Research assistant SKILL.md | ❌ Missing | `.agents/skills/research-assistant/SKILL.md` |

**Critical gap**: `streamText({ model: resolvedModel })` currently receives a plain string model ID regardless of `useWebSearch`. No grounding is activated. The model answers from training data even when the user explicitly toggled web search on.

---

## 4. Layer 1 — Google Search Grounding (Gemini)

### How it works

The `@ai-sdk/google` provider supports Google Search grounding as a model-level option. When `useSearchGrounding: true` is set, Gemini fetches Google Search results internally before generating its response. Sources appear in the response metadata — no extra API call visible to the application, no token overhead for search results.

### Dependency check

```bash
# Check if @ai-sdk/google is already installed
pnpm list @ai-sdk/google
```

If not installed:
```bash
pnpm add @ai-sdk/google
```

Check the Vercel AI SDK version compatibility — `@ai-sdk/google` version should match the `ai` package major version in `package.json`.

### New helper: `resolveModelInstance()`

Create this in `lib/ai.ts` or inline in the chat route. Recommended location: `lib/ai.ts` so it's testable and reusable.

```typescript
// lib/ai.ts (add after existing exports)

import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * Resolve a model ID string to a LanguageModel instance.
 *
 * For most models (going through Vercel AI Gateway), returning the string
 * ID is sufficient — the AI SDK resolves it automatically.
 *
 * For Gemini models with web search requested, we must use the @ai-sdk/google
 * provider directly to enable Search grounding. The Vercel AI Gateway string
 * form does not support grounding options.
 */
export function resolveModelInstance(
  modelId: string,
  options: { useSearchGrounding?: boolean } = {}
): LanguageModel | string {
  if (options.useSearchGrounding && modelId.startsWith('google/')) {
    // Strip the "google/" prefix — @ai-sdk/google uses bare Gemini IDs
    const geminiModelId = modelId.replace('google/', '');
    return google(geminiModelId, { useSearchGrounding: true });
  }
  // All other models: return string, Vercel AI Gateway handles resolution
  return modelId;
}
```

### Grounding source metadata

When grounding is active, Gemini returns source URLs in the response metadata. The Vercel AI SDK surfaces these via `result.providerMetadata`. To show sources in the UI:

```typescript
// In the onFinish handler of streamText (app/api/chat/route.ts)
// result.providerMetadata?.google?.groundingMetadata?.webSearchQueries
// result.providerMetadata?.google?.groundingMetadata?.groundingChunks
```

The grounding metadata is structured as:
```json
{
  "groundingMetadata": {
    "webSearchQueries": ["cassava price Thailand 2025"],
    "groundingChunks": [
      { "web": { "uri": "https://...", "title": "..." } }
    ],
    "groundingSupports": [...]
  }
}
```

Saving these sources to the message metadata is optional for the initial implementation — the AI will already cite sources in its text output when the research-assistant skill is active.

### Important: @ai-sdk/google vs Vercel AI Gateway

The project uses `gateway: "vercel"` for all models, passing string model IDs to `streamText`. The `@ai-sdk/google` provider bypasses the gateway and calls the Google Generative AI API **directly**.

This means:
1. You need a `GOOGLE_GENERATIVE_AI_API_KEY` environment variable (separate from any gateway key)
2. The Vercel AI Gateway's token accounting will NOT capture these calls
3. Credit deduction still works because it happens before `streamText` is called

If this is a concern, the Tavily tool (Layer 2) is the gateway-compatible alternative and can be used exclusively.

---

## 5. Layer 2 — Tavily Web Search Tool

### Why Tavily

Tavily is purpose-built for AI agents. Unlike raw search APIs, it:
- Returns cleaned, structured text (not raw HTML)
- Provides a pre-synthesized `answer` field alongside individual results
- Supports `search_depth: "advanced"` for multi-page crawl research
- Has a free tier of 1,000 API calls/month — sufficient for initial users

Sign up at tavily.com to get an API key.

### File to create: `lib/tools/web-search.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
};

type TavilyResponse = {
  answer?: string;
  results: TavilyResult[];
  query: string;
};

/**
 * Web search tool backed by Tavily.
 * Works for any tool-capable model (Gemini, Claude, GPT, DeepSeek, etc.)
 * Used as a fallback when Google grounding is unavailable, and as a
 * complement when the AI needs explicit multi-hop search control.
 */
export const webSearchTools = {
  web_search: tool({
    description:
      'Search the web for current information: news, prices, regulations, product specs, ' +
      'events, or any facts that may have changed since the model was trained. ' +
      'Use this when the user asks about something recent, live, or time-sensitive. ' +
      'For Thai-specific topics, prefer adding "ประเทศไทย" or "Thailand" to the query.',
    parameters: z.object({
      query: z.string().describe(
        'The search query. Be specific. Include date context when relevant, e.g. "cassava price Thailand 2025"'
      ),
      search_depth: z
        .enum(['basic', 'advanced'])
        .optional()
        .default('basic')
        .describe('Use "advanced" for research requiring deeper crawl. Costs more API quota.'),
    }),
    execute: async ({ query, search_depth }) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return { error: 'Web search is not configured. TAVILY_API_KEY is missing.' };
      }

      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: search_depth ?? 'basic',
            max_results: 5,
            include_answer: true,
            include_raw_content: false, // keep tokens low
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          return { error: `Search failed: ${res.status} — ${errorText}` };
        }

        const data = (await res.json()) as TavilyResponse;

        return {
          query: data.query,
          summary: data.answer ?? null,
          results: data.results.map((r) => ({
            title: r.title,
            url: r.url,
            // Truncate to 600 chars per result — enough context, avoids token explosion
            content: r.content.slice(0, 600),
            relevance_score: r.score,
            published_date: r.published_date ?? null,
          })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { error: `Search request failed: ${message}` };
      }
    },
  }),
};
```

### Register in `lib/tools/index.ts`

```typescript
// Add to existing imports
import { webSearchTools } from './web-search';

// Add to buildToolSet(), after the weather block
if (ids.includes('web_search')) {
  Object.assign(result, webSearchTools);
}
```

### Register tool ID in tool registry

Check `lib/tool-registry.ts` (or wherever `ALL_TOOL_IDS` is defined) and add `'web_search'`.

```typescript
export const ALL_TOOL_IDS = [
  'weather',
  'knowledge_base',
  'web_search',   // ← add this
  // ...existing registry tool IDs
];
```

The `web_search` tool does NOT need a sidebar page, manifest, or agent adapter — it is a global special tool like `weather`, not a registry-managed tool.

### Conditional activation

The tool should only be added to the toolset when `useWebSearch` is true **or** when the model lacks native grounding. Simplest approach: always include it when the tool ID is enabled, let the research-assistant skill guide the AI on when to call it.

---

## 6. Layer 3 — Research Assistant Skill

### File to create: `.agents/skills/research-assistant/SKILL.md`

```markdown
---
name: research-assistant
description: >
  Activate when the user asks to research, look up, find current information,
  fact-check, compare options, investigate a topic, or asks about anything
  recent, live, or time-sensitive (prices, news, regulations, events, products).
  Provides systematic multi-source research with citation and confidence signals.
triggerType: keyword
keywords:
  - research
  - search
  - look up
  - find out
  - latest
  - current
  - today
  - ค้นหา
  - ค้น
  - หาข้อมูล
  - ล่าสุด
  - ราคา
  - ข่าว
---

## Research Protocol

You have access to real-time web search. Use it systematically.

### When to search

Search proactively when the user's question involves:
- Prices, rates, or market data (always search — these change daily)
- News or recent events (anything from the last 12 months)
- Regulations, laws, or official policies (verify current status)
- Product comparisons, specs, or availability
- Any specific date, event, or time-sensitive fact

Do NOT search for:
- General concepts, definitions, or explanations you already know well
- Historical facts with stable records (e.g. "when was the French Revolution")
- Creative tasks (writing, brainstorming, drafting)

### Search strategy

Break complex questions into specific sub-queries. Run 2–3 searches rather than one broad search.

Example:
- User asks: "Which smartphone should I buy for under 15,000 baht?"
- Bad: `search("best phone")` → too broad
- Good:
  1. `search("best smartphones under 15000 baht Thailand 2025")`
  2. `search("camera comparison mid-range phones 2025")`
  3. `search("Samsung vs Xiaomi vs Realme 15000 baht Thailand")`

For Thai-specific topics, prefer Thai market sources. Add "Thailand", "ไทย", or "ประเทศไทย" to queries about prices, regulations, or services.

### Synthesizing results

After searching:
1. Read all results before writing your answer
2. Look for agreement across 2+ sources → higher confidence
3. Note if sources contradict each other — say so, don't pick one arbitrarily
4. Prefer recent sources (check published_date in results when available)

### Answer format

Structure your answer as:
1. **Direct answer** — the most important finding first
2. **Supporting detail** — context, caveats, comparisons
3. **Confidence note** (if not high) — explain why
4. **Sources** — always list, always link

Sources format:
> **Sources:** [Title](url) • [Title](url) • [Title](url)

### Confidence levels

Use these signals to set user expectations:

| Signal | Confidence | How to communicate |
|---|---|---|
| 2+ sources agree, data < 3 months old | High | State directly |
| 1 credible source, or data 3–12 months old | Medium | "As of [date]..." |
| 1 blog/forum source, or data > 12 months old | Low | ⚠️ "This may be outdated..." |
| Sources contradict each other | Uncertain | Explain the disagreement |

### Thai context rules

- Convert USD prices to THB where helpful (approximate: ×36, note it's approximate)
- For regulations, prefer official Thai government sources (.go.th domains)
- For agricultural prices, prefer DOAE (กรมส่งเสริมการเกษตร) or Kasikorn Research data
- When a Thai-language source is available and the user wrote in Thai, prefer quoting it in Thai with a brief translation
- Do not fabricate official Thai statistics — if you cannot find data, say so clearly

### When search fails or returns nothing useful

Tell the user directly:
> "I searched for this but couldn't find reliable current data. [Explain what you found or why it's unclear.] You may want to check [specific source] directly."

Do not fabricate data to cover a failed search.
```

### Creating the skill in the app

Once the SKILL.md file exists, the General Assistant agent definition can import or reference it. There are two options:

**Option A**: Create it as a built-in skill via the admin panel or seed script, attaching it to the default General Assistant agent with `activationMode: "model"` (auto-activated by relevance) and `triggerType: "keyword"`.

**Option B**: Import it from the GitHub repo path via the existing skill import flow at `/api/skills/import`.

For the initial implementation, Option A (seeded to the DB) is recommended so every new user gets it automatically.

---

## 7. Wiring It All Together in the Chat Route

### Changes to `app/api/chat/route.ts`

#### Step 1: Import the resolver

```typescript
// Add to imports at top of file
import { resolveModelInstance } from '@/lib/ai';
```

#### Step 2: Replace string model in streamText

Find the `streamText()` call (currently around line 495) and change `model`:

```typescript
// Before
const result = streamText({
  model: resolvedModel,
  system: effectiveSystemPrompt,
  messages: await convertToModelMessages(messagesForLLM),
  stopWhen: stepCountIs(maxSteps),
  ...(supportsTools ? { tools: activeTools } : {}),
});

// After
const modelInstance = resolveModelInstance(resolvedModel, {
  useSearchGrounding: useWebSearch && modelSupportsCapability(resolvedModel, 'web search'),
});

const result = streamText({
  model: modelInstance,
  system: effectiveSystemPrompt,
  messages: await convertToModelMessages(messagesForLLM),
  stopWhen: stepCountIs(maxSteps),
  ...(supportsTools ? { tools: activeTools } : {}),
});
```

`modelSupportsCapability` is already exported from `features/chat/server/routing.ts` — import it.

#### Step 3: Include web_search in the tool set

The `buildToolSet()` call already uses `activeToolIds`. The `web_search` tool will be included automatically once it's added to `ALL_TOOL_IDS` and `lib/tools/index.ts`. No additional wiring needed here.

To scope it to web-search-enabled sessions only, you can pass a conditional:

```typescript
// In buildToolSet options, add:
enabledWebSearch: useWebSearch,

// In buildToolSet() implementation:
if (ids.includes('web_search') && options.enabledWebSearch) {
  Object.assign(result, webSearchTools);
}
```

This is optional — including `web_search` in all sessions is also fine; the AI will only call it when appropriate.

---

## 8. Model Capability Matrix

Which layer applies to which model:

| Model | Layer 1 (Grounding) | Layer 2 (Tavily) | Notes |
|---|---|---|---|
| `google/gemini-2.5-flash-lite` (default) | ✅ Yes | ✅ Yes (fallback) | Grounding preferred |
| `google/gemini-3.x-*` | ✅ Yes | ✅ Yes (fallback) | Grounding preferred |
| `openai/gpt-5.4-*` | ❌ No | ✅ Yes | GPT has no native grounding via this provider |
| `anthropic/claude-*` | ❌ No | ✅ Yes | Claude Opus has `"web search"` tag — currently via Anthropic's search API (future) |
| `xai/grok-*` | ❌ No | ✅ Yes | Grok has live X/web data but not via this provider config |
| `deepseek/deepseek-*` | ❌ No | ✅ Yes | Tool only |
| `minimax/minimax-*` | ❌ No | ✅ Yes | Tool only |
| `alibaba/qwen-*` | ❌ No | ✅ Yes | Tool only |

The router already picks a Gemini or GPT-5.4 model when `wantsWeb` is true — no change needed to the routing logic.

---

## 9. Environment Variables

```bash
# Required for Layer 1 (Google grounding via @ai-sdk/google directly)
GOOGLE_GENERATIVE_AI_API_KEY=   # Google AI Studio key (separate from Vercel AI Gateway)

# Required for Layer 2 (Tavily)
TAVILY_API_KEY=                  # From tavily.com — free tier: 1000 calls/month
```

Add these to `.env.local` for development and to the Vercel project environment variables for production.

### Cost awareness

| Source | Cost | Volume |
|---|---|---|
| Google grounding | Free (token cost only) | Unlimited |
| Tavily basic search | Free up to 1,000/mo, then ~$0.004/call | Fine for early users |
| Tavily advanced search | ~$0.008/call | Reserve for research-heavy agents |

A user doing 10 research queries/day costs roughly $0.04/day in Tavily calls beyond the free tier. Well within acceptable range.

---

## 10. Implementation Checklist

Work through these in order. Each step is independently deployable.

### Phase A — Tavily Tool (no new API key risk, universal benefit)

- [ ] Create `lib/tools/web-search.ts` with `webSearchTools`
- [ ] Add `web_search` to `ALL_TOOL_IDS` in the tool registry
- [ ] Register `web_search` in `buildToolSet()` in `lib/tools/index.ts`
- [ ] Add `TAVILY_API_KEY` to env (`.env.local` + Vercel dashboard)
- [ ] Test: send a message with the web search toggle on → confirm tool call appears in message

### Phase B — Google Grounding (requires `GOOGLE_GENERATIVE_AI_API_KEY`)

- [ ] Verify `@ai-sdk/google` is installed (`pnpm list @ai-sdk/google`)
- [ ] Install if missing: `pnpm add @ai-sdk/google`
- [ ] Add `resolveModelInstance()` to `lib/ai.ts`
- [ ] Import `resolveModelInstance` and `modelSupportsCapability` in `app/api/chat/route.ts`
- [ ] Replace string `model: resolvedModel` in `streamText()` with `model: modelInstance`
- [ ] Add `GOOGLE_GENERATIVE_AI_API_KEY` to env
- [ ] Test: default Gemini model + web search toggle → grounding sources appear in response

### Phase C — Research Assistant Skill

- [ ] Create `.agents/skills/research-assistant/SKILL.md` (content in Section 6)
- [ ] Seed the skill to DB for the default General Assistant agent (or import via skill import API)
- [ ] Set `activationMode: "model"` and `triggerType: "keyword"` on the skill attachment
- [ ] Test: ask "what is the price of tomatoes in Bangkok today" → AI searches 2+ times, cites sources

### Phase D — Validation

- [ ] Run `pnpm exec tsc --noEmit` — no type errors
- [ ] Run `pnpm build` — no build errors
- [ ] Test non-Gemini model (Claude Haiku) with web search toggle → Tavily tool used
- [ ] Test with `TAVILY_API_KEY` missing → graceful error message, not crash
- [ ] Test with `useWebSearch: false` → no web search tool called, no grounding

---

## 11. Common Mistakes & Gotchas

### `@ai-sdk/google` bypasses the Vercel AI Gateway

When you use `google(modelId, { useSearchGrounding: true })`, the call goes directly to Google Generative AI API — it does NOT pass through the Vercel AI Gateway. This means:

1. You must have a valid `GOOGLE_GENERATIVE_AI_API_KEY` (not just a Vercel gateway key)
2. Vercel AI Gateway usage/cost tracking will not capture these calls
3. Credit deduction in `lib/credits.ts` still works correctly (it runs before `streamText`)

If you want all calls to go through the gateway, skip Layer 1 and use Tavily only.

### The `web search` capability tag is currently just routing metadata

`"web search"` in `lib/ai.ts` model capabilities is only used by the router to pick the right model. It does not activate any search feature. This guide adds the actual activation.

### Tavily `max_results: 5` and 600-char truncation

The truncation is intentional. Full page content from 5 results can consume 3,000–8,000 tokens — expensive and often not necessary. The `include_answer: true` field gives a pre-synthesized summary that covers most use cases. Increase `max_results` or truncation limit only for agents with a specific deep-research mandate.

### Tool call count and `maxSteps`

`maxSteps` in `lib/ai.ts` is currently `5`. Multi-hop research might call `web_search` 2–3 times plus other tools. If users report responses getting cut off mid-research, increase `maxSteps` to `8` for web-search-enabled sessions.

```typescript
// In streamText call, conditionally increase steps
stopWhen: stepCountIs(useWebSearch ? 8 : maxSteps),
```

### Do not make `web_search` a registry tool

The tool registry (`features/tools/registry/`) is for sidebar-page tools with manifests, schemas, and agent adapters. `web_search` is a global special tool like `weather` — it lives in `lib/tools/` and is added directly in `buildToolSet()`. No manifest, no sidebar page.

### The research-assistant skill competes with other active skills

If the agent has many skills active simultaneously, the research protocol instructions add ~300–400 tokens to the system prompt on every relevant message. This is acceptable, but avoid attaching the skill to agents that already have domain-specific research instructions — redundant guidance wastes tokens.

### Thai-language search queries

Tavily supports Thai-language queries but quality is lower for Thai content than English. Recommend always appending "Thailand" or key Thai terms even in English queries to improve result relevance for Thai users.

---

## 12. Testing

### Manual test matrix

| Scenario | Expected |
|---|---|
| Web search toggle ON + Gemini model | Google grounding activates, sources cited in response |
| Web search toggle ON + Claude model | Tavily `web_search` tool called 1–3 times, sources cited |
| Web search toggle OFF | No tool calls, no grounding, model answers from training data |
| `TAVILY_API_KEY` missing, toggle ON | Graceful error: "Web search is not configured" in tool result |
| Query: "price of cassava today" (keyword triggers) | Research-assistant skill auto-activates, AI searches proactively |
| Query: "write me a poem" | No search tool called |
| Multi-hop: "compare Samsung vs Xiaomi under 15000 baht" | AI calls `web_search` 2–3 times, synthesizes comparison |

### Confirming grounding is active

Google grounding does not show as a visible tool call in the UI — it operates transparently. To verify it's active:

1. Check the response includes inline citations or a sources block
2. Add a temporary log: `console.log('providerMetadata:', await result.providerMetadata)` in the `onFinish` handler and look for `google.groundingMetadata`

### Confirming Tavily tool calls

When the Tavily tool is called, it appears as a `tool-invocation` part in the message stream. The chat UI renders tool calls as collapsible blocks (if the message renderer supports it) or they appear in the raw message parts in browser DevTools.
