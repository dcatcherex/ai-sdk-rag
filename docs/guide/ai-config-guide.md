# AI Config Guide — Model Slots & Prompt Templates

> Audience: AI coders and developers adding new AI features or changing how models/prompts are resolved.
> Purpose: explain the centralized AI config system so you never hardcode a model ID or prompt again.

---

## Why This Exists

Before this system, model IDs and system prompts were scattered across 25+ files as constants:

```typescript
// Old pattern — do NOT do this
const MEMORY_MODEL = 'google/gemini-2.5-flash-lite';
const result = await generateText({ model: MEMORY_MODEL, ... });
```

Changing the background model meant a grep across the entire codebase, followed by a deployment.

The AI Config system replaces this with a **DB-driven singleton** and **60-second in-process cache**, so model slots and prompt templates can be updated from the admin panel at `/admin/ai-config` without touching code.

---

## System Overview

```
Admin UI (/admin/ai-config)
    │
    ▼
API routes (/api/admin/ai-config/...)
    │
    ▼
features/ai-config/server/service.ts   ← business logic (upsert, versioning, rollback)
    │
    ▼
DB tables: ai_model_slots  /  ai_prompt_template  /  ai_prompt_template_version
    │
    ▼
lib/ai-config.ts   ← 60s-cached read layer (getModelSlot, getPrompt)
    │
    ▼
All service files, hooks, routes
```

---

## lib/ai-config.ts — The One Import

Everything reads from a single module. Never query the DB tables directly in feature code.

```typescript
import { getModelSlot, getPrompt, invalidateAIConfigCache } from '@/lib/ai-config';
```

### `getModelSlot(slot)`

Returns the configured model ID for a named slot, falling back to the hardcoded default if the DB row is NULL.

```typescript
// Required slots — return type is Promise<string> (never null)
const model = await getModelSlot('chatModel');
const model = await getModelSlot('backgroundModel');
const model = await getModelSlot('embeddingModel');
const model = await getModelSlot('imageModel');
const model = await getModelSlot('ttsModel');
const model = await getModelSlot('transcriptionModel');
const model = await getModelSlot('liveModel');

// Optional slots — return type is Promise<string | null>
const model = await getModelSlot('videoModel');   // null if not configured
const model = await getModelSlot('audioModel');   // null if not configured
```

TypeScript overloads enforce correctness: required slots are guaranteed non-null, optional slots must be null-checked.

### `getPrompt(key, fallback?)`

Returns the active version content for a prompt template key. If no DB template exists yet for that key, returns the `fallback` string (defaults to `''`).

```typescript
const systemPrompt = await getPrompt('system.default', HARDCODED_FALLBACK);
const summaryPrompt = await getPrompt('summary.default', DEFAULT_SUMMARY_PROMPT);
```

### `invalidateAIConfigCache(target?)`

Drops the in-process cache. Call this after any admin write. `target` can be `'slots'`, `'prompts'`, or `'all'` (default).

```typescript
invalidateAIConfigCache('slots');   // after upsertModelSlots
invalidateAIConfigCache('prompts'); // after createPromptVersion or rollback
```

This is already called inside `service.ts` — you only need it if you write your own admin mutations.

---

## Slot Reference

| Slot key             | Default value                            | What uses it |
|----------------------|------------------------------------------|--------------|
| `chatModel`          | `google/gemini-3.1-flash-lite-preview`   | Chat route, agent teams orchestrator |
| `backgroundModel`    | `google/gemini-2.5-flash-lite`           | Memory extraction, summaries, content generation, skill discovery, analytics |
| `embeddingModel`     | `mistral/mistral-embed`                  | `lib/embeddings.ts`, RAG indexing |
| `imageModel`         | `google/gemini-3.1-flash-image-preview`  | Image generation tool |
| `ttsModel`           | `gemini-3.1-flash-tts-preview`           | Text-to-speech |
| `transcriptionModel` | `gemini-2.5-flash-lite`                  | Audio transcription |
| `liveModel`          | `gemini-3.1-flash-live-preview`          | Gemini Live streaming |
| `videoModel`         | `null`                                   | Video generation (optional) |
| `audioModel`         | `null`                                   | Audio generation (optional) |

---

## Prompt Template Keys

| Key              | Used by                        | Notes |
|------------------|-------------------------------|-------|
| `system.default` | `lib/prompt.ts getSystemPrompt()` | Base system prompt injected in every chat session |

Add new keys as you introduce new prompts. The key naming convention is `feature.purpose`, e.g. `summary.default`, `skills.discovery`, `content.trend-analysis`.

---

## Adding a New Service That Uses a Model

This is the pattern every new service should follow:

```typescript
// features/my-feature/service.ts
import { generateText } from 'ai';
import { getModelSlot } from '@/lib/ai-config';

export async function myFeatureService(input: string): Promise<string> {
  const modelId = await getModelSlot('backgroundModel');

  const { text } = await generateText({
    model: modelId as Parameters<typeof generateText>[0]['model'],
    prompt: input,
  });

  return text;
}
```

Key points:
- Always `await getModelSlot(...)` at the call site — it is fast (cache hit < 1 ms after first load).
- Cast `modelId` to the AI SDK's model parameter type if TypeScript complains.
- Never store the result in a module-level variable — that defeats the 60s refresh.

---

## Adding a New Prompt Template

**Step 1 — define a fallback constant in your service:**

```typescript
const DEFAULT_MY_PROMPT = `
You are a specialist. Your task is to...
`.trim();
```

**Step 2 — read from DB with fallback:**

```typescript
import { getPrompt } from '@/lib/ai-config';

const prompt = await getPrompt('my-feature.default', DEFAULT_MY_PROMPT);
```

**Step 3 — seed the template via admin UI (optional but recommended):**

Go to `/admin/ai-config` → Prompt Templates → New Template.
Set the key to `my-feature.default`, paste the default content, save.

Once it exists in DB, the admin can edit it without touching code.

**Step 4 — document the key in this guide's Prompt Template Keys table.**

---

## Adding a New Model Slot

Only do this if you are introducing an entirely new category of model (e.g. a dedicated reranking model). For most cases `backgroundModel` is the right choice.

1. Add the field to `db/schema/ai-config.ts` → `aiModelSlots` table:
   ```typescript
   rerankModel: text('rerank_model'),
   ```
2. Run `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`.
3. Add the field to `AiModelSlotsRow` (auto-generated by Drizzle).
4. Add the default to `SLOT_DEFAULTS` in `lib/ai-config.ts`.
5. Add to `RequiredSlot` or `OptionalSlot` union type in `lib/ai-config.ts`.
6. Add the Zod field to the admin API route (`app/api/admin/ai-config/slots/route.ts`).
7. Add the input field to `SLOT_FIELDS` in `features/ai-config/components/ai-config-page.tsx`.

---

## Caching Behaviour

```
First request after cold start (or cache expiry):
  getModelSlot / getPrompt
      → DB query (single SELECT, < 5 ms on Neon)
      → store in module-level variable with expiry = now + 60s
      → return value

Subsequent requests within 60 s:
  getModelSlot / getPrompt
      → read module-level variable
      → return value (< 0.1 ms, no DB)

After admin writes (invalidateAIConfigCache):
  → variable set to null / map cleared
  → next call triggers fresh DB query
```

Multi-instance deployments (Vercel / Railway): each instance has its own cache. After an admin write, other instances will serve stale config for up to 60 s. This is intentional and acceptable — model changes are not time-critical.

---

## File Map

| File | Purpose |
|------|---------|
| `lib/ai-config.ts` | Cache layer — `getModelSlot`, `getPrompt`, `invalidateAIConfigCache` |
| `db/schema/ai-config.ts` | Drizzle table definitions and exported row types |
| `features/ai-config/server/service.ts` | Admin mutations — `upsertModelSlots`, `createPromptVersion`, `rollbackPromptToVersion`, list helpers |
| `app/api/admin/ai-config/slots/route.ts` | GET (current + resolved) / PATCH (update slots) |
| `app/api/admin/ai-config/prompts/route.ts` | GET (list templates) / POST (create template + v1) |
| `app/api/admin/ai-config/prompts/[key]/versions/route.ts` | GET (versions) / POST (new version) / PATCH (rollback) |
| `features/ai-config/components/ai-config-page.tsx` | Admin UI component |
| `app/admin/ai-config/page.tsx` | Next.js page at `/admin/ai-config` |
| `db/migrations/0065_ai_model_slots_and_prompt_templates.sql` | Migration SQL (already applied) |

---

## Admin UI Walkthrough

Navigate to `/admin/ai-config` in the admin panel.

### Model Slots tab

- Shows all 9 slots. Placeholder text shows the hardcoded default.
- A **custom** badge appears when a slot is overridden in DB.
- Leave a field blank to revert to the hardcoded default.
- Click **Save Slots** — changes take effect on all instances within 60 s.

### Prompt Templates tab

- Lists all templates. Click a card to expand it.
- **Active Content** shows the current live version.
- Click **Edit** to open an inline editor. Saving creates a new version (previous versions are preserved).
- Expand **Version history** to see all past versions. Click **Restore** to roll back.
- Click **New Template** to create a template for a key that doesn't exist in DB yet.

---

## Common Mistakes

| Mistake | Correct approach |
|---------|-----------------|
| `const MODEL = 'google/...'` at module level | `const modelId = await getModelSlot('backgroundModel')` inside the function |
| Direct `db.select().from(aiModelSlots)` in feature code | Use `getModelSlot()` — it has the cache |
| Calling `invalidateAIConfigCache()` in a client component | Only call from server-side service code after a DB write |
| Using `chatModel` for background tasks | Use `backgroundModel` — chat model may be slower/pricier |
| Forgetting `await` on `getModelSlot` | It is async — always `await` it |
| Storing `await getModelSlot(...)` in a module-level `let` | This freezes the value at import time; put the call inside the function |

---

## Sequence: Admin Updates a Model Slot

```
Admin opens /admin/ai-config → Model Slots tab
Admin types new model ID into "Background Model" field
Admin clicks Save Slots
    → PATCH /api/admin/ai-config/slots
    → requireAdmin() validates session
    → upsertModelSlots({ backgroundModel: 'new-model' }, userId)
        → db.insert(aiModelSlots).onConflictDoUpdate(...)
        → invalidateAIConfigCache('slots')
    → returns updated row

Next generateText call in any service:
    → getModelSlot('backgroundModel')
    → cache is empty → SELECT from ai_model_slots
    → returns 'new-model'
    → cache refilled with 60s TTL
```

## Sequence: Admin Edits a Prompt and Rolls Back

```
Admin opens Prompt Templates tab → clicks "Base System Prompt"
Admin clicks Edit → modifies content → clicks Save New Version
    → POST /api/admin/ai-config/prompts/system.default/versions
    → createPromptVersion({ key: 'system.default', content: '...', createdBy })
        → inserts ai_prompt_template_version with version = MAX + 1
        → updates ai_prompt_template.active_version_id
        → invalidateAIConfigCache('prompts')

Something is wrong — admin expands Version History → clicks Restore on v1
    → PATCH /api/admin/ai-config/prompts/system.default/versions { versionId: 'ptv_...' }
    → rollbackPromptToVersion(templateId, versionId)
        → verifies versionId belongs to this template (security check)
        → updates active_version_id back to v1
        → invalidateAIConfigCache('prompts')

Next getSystemPrompt() call:
    → getPrompt('system.default', fallback)
    → cache is empty → DB join returns v1 content
    → v1 is now live again
```
