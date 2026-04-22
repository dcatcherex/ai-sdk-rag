# Image Generation System — Implementation Guide

For AI coders and developers maintaining this feature.

---

## Overview

Image generation is async-first: the agent tool fires a job, returns a `generationId` immediately, and the image appears in the chat when it completes. The KIE gateway handles the actual model calls; this app manages routing, credits, persistence, and UI display.

---

## Architecture

```
User message → Agent LLM
                 ↓
         generate_image tool (features/image/agent.ts)
                 ↓ resolves model via admin config (imageModelConfig)
         POST /api/image (app/api/image/route.ts)
                 ↓ rate-limit check → credit enforcement → refund-on-error
         triggerImageGeneration() (features/image/service.ts)
                 ↓
         KIE API (external) → returns kieTaskId
                 ↓
         toolRun row created (toolSlug: 'image', status: 'pending')
         inputJson: { kieTaskId, modelId, prompt, ... }
                 ↓
    ┌────────────────────────────────┐
    │  KIE completes (async)         │
    ├────────────────────────────────┤
    │  A. Webhook: POST /api/kie/callback  (preferred)
    │  B. Polling: GET /api/generate/status?taskId=...&generationId=...
    └────────────────────────────────┘
                 ↓
         toolRun updated (status: 'success', outputJson: { output, outputs })
         image re-uploaded to R2 → mediaAsset upserted
                 ↓
         UI rehydrates chat message parts from toolRun.outputJson
         → imageUrl / imageUrls injected into tool part output
```

---

## Key Files

| File | Purpose |
|------|---------|
| `features/image/agent.ts` | AI SDK `tool()` wrapper — task hint resolution, parameter normalization |
| `features/image/service.ts` | `triggerImageGeneration()` — KIE API call, DB persistence |
| `features/image/types.ts` | `IMAGE_MODEL_CONFIGS`, `resolveImageCredits()` |
| `app/api/image/route.ts` | Public entry point — auth, rate limiting, credit enforcement, refund on error |
| `lib/models/kie-image.ts` | Model registry — all KIE models with capabilities |
| `lib/providers/media/kie-image-adapter.ts` | KIE HTTP adapter — maps params → KIE request format |
| `lib/generation/create-media-run.ts` | Inserts pending `toolRun` row (shared across image/video/audio) |
| `lib/generation/complete-media-run.ts` | Marks `toolRun` as `success`, writes `outputJson` |
| `lib/generation/fail-media-run.ts` | Marks `toolRun` as `failed`, writes error |
| `app/api/kie/callback/route.ts` | KIE webhook receiver — normalizes payload, finalizes toolRun + mediaAsset |
| `app/api/generate/_shared/kieStatus.ts` | `resolveKieJobsStatusPayload()` — normalizes KIE status payloads across providers |
| `app/api/generate/status/route.ts` | Client polling fallback — checks KIE status if no callback |
| `features/chat/server/message-hydration.ts` | Rehydrates chat message tool parts with URLs from `toolRun.outputJson` |
| `app/api/admin/image-models/route.ts` | Admin CRUD for `imageModelConfig` |
| `app/admin/image-models/page.tsx` | Admin UI — enable/disable, set default, task defaults |
| `db/schema/admin.ts` | `imageModelConfig` table definition |
| `db/schema/tools.ts` | `toolRun`, `toolArtifact` table definitions |
| `db/schema/chat.ts` | `mediaAsset` table definition (line 115) |

---

## Model Registry (`lib/models/kie-image.ts`)

`KIE_IMAGE_MODELS` is the **source of truth** for what models exist. The DB table `imageModelConfig` only stores overrides; models not in DB are treated as enabled with no custom config.

Each model entry:

```typescript
{
  id: 'gpt-image/1.5-text-to-image',  // matches imageModelConfig.id
  name: 'GPT Image 1.5',
  provider: 'kie',
  costPerGeneration: 10,
  imageOptions: {
    iconProvider: 'openai',
    mode: 'generate' | 'edit' | 'both',
    badge: 'NEW',              // optional display badge
    hasQuality: true,          // supports quality param (medium/high)
    hasEnablePro: false,       // supports Grok pro mode
    hasResolution: false,      // supports 1K/2K/4K resolution
    hasGoogleSearch: false,    // supports grounded generation
    hasSeed: false,
    aspectRatios: ['1:1', '16:9', '9:16', ...],
    pricingTiers: {            // optional — dynamic credit cost
      param: 'quality',
      map: { medium: 10, high: 20 },
      default: 'medium',
    },
  },
}
```

To add a new model: append an entry to `KIE_IMAGE_MODELS`. No migration needed — the admin UI picks it up automatically on next page load.

---

## Admin Configuration (`imageModelConfig` table)

Admins control per-model behavior at `/admin/image-models`.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | Matches `KIE_IMAGE_MODELS` id |
| `enabled` | boolean | Show/hide from users |
| `isDefault` | boolean | Fallback when no taskHint matches |
| `defaultAspectRatio` | text | Pre-set aspect ratio |
| `defaultQuality` | text | `medium` or `high` |
| `defaultResolution` | text | `1K`, `2K`, or `4K` |
| `defaultEnablePro` | boolean | Grok pro mode default |
| `defaultGoogleSearch` | boolean | Nano Banana 2 grounded default |
| `taskDefaults` | text[] | Tasks this model handles by default |
| `adminNotes` | text | Free-text notes |

**`taskDefaults` enforcement:** Each task can only be owned by one model. When the admin assigns a task to a model, the API removes that task from all other models first (via `array_remove`). A model can cover multiple tasks (e.g., a model good at both `social_post` and `edit`).

### Task Types

| Value | When to use |
|-------|-------------|
| `social_post` | Social media graphics, banners, marketing — anything needing rendered text |
| `photorealistic` | Realistic photos, portraits, product shots |
| `illustration` | Art, anime, concept art, stylized visuals |
| `edit` | Image-to-image editing / transformation |

---

## Task Hint System (`features/image/agent.ts`)

The LLM sets `taskHint` on the `generate_image` call. The tool resolves the actual model:

```
1. params.modelId set?         → use it (user explicitly requested a model)
2. params.taskHint set?        → query imageModelConfig WHERE task_defaults @> ARRAY[taskHint]
3. No task match               → query imageModelConfig WHERE is_default = true
4. No default configured       → hard fallback: 'gpt-image/1.5-text-to-image'
```

`enablePro` follows the same resolution: explicit param → admin `defaultEnablePro` for the resolved model.

Key: the LLM describes **what it wants** (`taskHint`), not which model to use. Admins control the mapping, making the system resilient to model changes without LLM prompt updates.

---

## API Entry Point (`app/api/image/route.ts`)

All generation requests — from the sidebar UI and from the agent tool — go through this route. It is the single enforcement point for:

1. **Authentication** — `requireUser()`
2. **Rate limiting** — `enforceRateLimit(userId)`
3. **Input validation** — `generateImageInputSchema.safeParse(body)`
4. **Credit resolution** — `resolveImageCredits(modelConfig, { resolution, quality })` for tier-based models
5. **Credit enforcement** — `enforceCredits(userId, modelId, resolvedCost)` — returns 402 if insufficient
6. **Refund on error** — `refundGenerationCredits(userId, modelId, resolvedCost)` called in the catch block if `triggerImageGeneration` throws

`triggerImageGeneration()` in `service.ts` does **not** handle credits itself — that is entirely the route's responsibility.

---

## Generation Flow (`features/image/service.ts`)

`triggerImageGeneration(params, userId, ctx?)`:

1. POST to KIE API via adapter (`lib/providers/media/kie-image-adapter.ts`) — gets back `{ kieTaskId }`
2. Call `createMediaRun({ toolSlug: 'image', userId, inputJson: { kieTaskId, ...params } })` → returns `{ generationId }`
3. Return `{ taskId: kieTaskId, generationId }` to caller

`createMediaRun` (`lib/generation/create-media-run.ts`) inserts a `toolRun` row with `status: 'pending'` and the KIE task ID stored inside `inputJson.kieTaskId`. The `generationId` is the `toolRun.id` — this is what the agent returns to the LLM and what the UI uses to poll.

---

## Completion Paths

### A. KIE Webhook (`app/api/kie/callback/route.ts`)

KIE POSTs to this endpoint when generation completes. The route:

1. Validates the callback token (`isValidKieCallbackToken`)
2. Extracts `data.taskId` from the raw payload via `getTaskIdFromPayload`
3. Finds the `toolRun` row: `WHERE inputJson->>'kieTaskId' = taskId`
4. Skips if already `success`
5. Normalizes the KIE payload via `resolveKieJobsStatusPayload()` (see below)
6. On `failed`: calls `failMediaRun({ generationId, errorMessage })`
7. On `completed`:
   - Calls `completeMediaRun({ generationId, outputUrl, outputUrls, latency })` → sets `status: 'success'`, writes `outputJson: { output, outputs, latency, callbackReceived: true }`
   - Re-uploads image(s) to R2 via `persistToolRunOutputToStorage` / `persistToolRunOutputsToStorage` (handles multi-image results)
   - Updates `outputJson` with permanent R2 URLs, upserts `mediaAsset` row in `db/schema/chat.ts`

### B. Client Polling (`app/api/generate/status/route.ts`)

Fallback for when the webhook doesn't fire (network issues, dev env):

```
GET /api/generate/status?taskId=<kieTaskId>&generationId=<toolRunId>
```

Polls KIE directly, then calls the same `completeMediaRun` / `failMediaRun` helpers when done. Returns current `toolRun` status so the UI can update.

### KIE Payload Normalization (`app/api/generate/_shared/kieStatus.ts`)

`resolveKieJobsStatusPayload(payload)` handles the diversity of KIE response shapes across providers:

- Returns `{ status: 'processing' }` if `code !== 200` but message looks like "null recordinfo" (job not ready yet)
- Returns `{ status: 'failed', error }` for actual failures
- For success: collects URLs from `resultJson.resultUrls`, `resultJson.images`, `resultUrls[]`, `results[].url`, `images[]` — deduped
- Returns `{ status: 'completed', outputUrl, outputUrls }` — always an array, first URL is primary

Used by both the webhook and the polling route to ensure identical behavior.

---

## Message Hydration (`features/chat/server/message-hydration.ts`)

Chat messages are persisted with a tool part in state `output-available` containing only the `generationId`. The actual image URLs live in `toolRun.outputJson`, not directly in the message. On each chat load (and after polling completes), hydration resolves them:

1. Collect all `generationId` values from tool parts in the message list
2. Batch-fetch matching `toolRun` rows
3. For each tool part where `run.status === 'success'`:
   - `extractMediaOutputUrls(run.outputJson)` → `{ outputUrls, thumbnailUrls }`
   - Inject `imageUrl` (first URL), `imageUrls` (full array), `thumbnailUrl`, `thumbnailUrls` into the tool part output
   - Set `state: 'output-available'`, `output.status: 'success'`

This means **multi-image results work automatically** — any model returning multiple URLs via `outputJson.outputs` will surface all of them in the UI without any special-casing in the message store.

---

## Database Tables

### `toolRun` (db/schema/tools.ts)
Tracks each generation job lifecycle.

| Column | Notes |
|--------|-------|
| `id` | `generationId` — nanoid, returned to LLM |
| `toolSlug` | `'image'` for image jobs |
| `userId` | owner |
| `status` | `'pending'` → `'success'` / `'failed'` |
| `inputJson` | `{ kieTaskId, modelId, prompt, aspectRatio, ... }` |
| `outputJson` | `{ output, outputs, latency, callbackReceived }` — set on completion |
| `errorMessage` | set on failure |
| `threadId` | chat thread that triggered it |
| `source` | `'agent'` / `'api'` / `'line'` |

### `mediaAsset` (db/schema/chat.ts, line 115)
Permanent gallery record created after R2 upload.

| Column | Notes |
|--------|-------|
| `id` | nanoid |
| `userId` | owner |
| `url` | Permanent R2 URL |
| `messageId` | FK → chatMessage |
| `threadId` | FK → chatThread |

---

## URL Handling

KIE returns temporary CDN URLs that expire (OpenAI `oaiusercontent.com`, Google `generativeai-filters`). The callback and polling routes **always re-upload to R2** via `persistToolRunOutputToStorage` to get a permanent URL before writing to `outputJson`.

`isTemporaryProviderImageUrl()` in `features/image/agent.ts` detects these URLs at the agent layer. When the LLM passes back a reference image URL that came from a prior provider response, the agent swaps it back to the original R2 URL stored in `referenceImageUrls` context — preventing "reference image inaccessible" errors when KIE tries to fetch it.

---

## Reference Images (Image-to-Image)

The agent receives `referenceImageUrls` from `AgentToolContext` — the user's uploaded files already persisted to R2. When the LLM includes a URL in `imageUrls` that originated from a provider response, `isTemporaryProviderImageUrl` detects it and substitutes the original R2 URL.

Error path: if KIE can't load the reference image, `service.ts` throws with a message containing "Reference image" or "no longer accessible". The agent tool catches this and returns `{ errorType: 'reference_image_inaccessible' }` — the LLM then stops and asks the user to re-upload instead of retrying blindly.

---

## Environment Variables

```
KIE_API_KEY          # KIE gateway API key
KIE_API_BASE_URL     # KIE gateway base URL
KIE_CALLBACK_SECRET  # Webhook token verification
R2_*                 # Cloudflare R2 credentials for image re-upload
```

---

## Debugging

### Image stuck in pending state
1. Check `toolRun` table: `SELECT id, status, input_json->>'kieTaskId', output_json FROM tool_run WHERE tool_slug = 'image' ORDER BY created_at DESC LIMIT 10`
2. If webhook never fired: check KIE dashboard for callback logs; the token is validated via `KIE_CALLBACK_SECRET`
3. Manually poll: `GET /api/generate/status?taskId=<kieTaskId>&generationId=<toolRunId>`
4. Check server logs for `[kie/callback]` and `[IMG-URL-TRACE]` prefixes

### Wrong model selected for task
1. Check `imageModelConfig` table: `SELECT id, task_defaults, is_default FROM image_model_config`
2. Task strings must match exactly: `social_post`, `photorealistic`, `illustration`, `edit`
3. Admin UI at `/admin/image-models` → Config → Task defaults checkboxes

### Adding a new model
1. Add entry to `KIE_IMAGE_MODELS` in `lib/models/kie-image.ts`
2. Add KIE adapter mapping in `lib/providers/media/kie-image-adapter.ts` if the model needs special param translation
3. Go to `/admin/image-models` — model appears automatically
4. Enable it and optionally set as default or assign task defaults

### SVG uploads failing
`uploadImage()` in `lib/storage/uploadImage.ts` detects SVGs by both MIME type (`image/svg+xml`) and filename extension (`.svg`) — Windows sometimes sends `text/xml` for SVGs. SVGs bypass the Sharp pipeline and upload raw. Max size still applies.

---

## Adding a New Task Type

1. Add the value to `TASK_HINT_VALUES` in `features/image/agent.ts`
2. Add description to `TASK_HINT_DESCRIPTIONS`
3. Add display label to `TASK_OPTIONS` in `app/admin/image-models/page.tsx`
4. Add display label to `TASK_LABELS` in the same file
5. No migration needed — `taskDefaults` is a free text array

The LLM reads the task descriptions from the tool schema dynamically, so it will start using the new task type immediately after deployment.
