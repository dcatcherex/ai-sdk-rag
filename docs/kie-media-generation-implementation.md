# KIE Media Generation Implementation Guide

## Purpose

This document defines the recommended architecture for making **KIE the canonical async backend for media generation** in Vaja.

Media generation here means:

- image generation
- image editing / image-to-image
- video generation
- audio generation
- speech / music generation

The main goal is to remove the current split between:

- async KIE task-based flows
- direct blocking provider calls inside chat or feature routes

and replace it with **one durable job model** that is easier to maintain, easier to observe, and better for UX.

---

## Decision

Vaja should adopt this rule:

**All product-facing media generation should go through one canonical async job pipeline, with KIE as the default execution backend.**

This means:

- chat should not block on final image bytes when the request is media generation
- tool pages should not invent separate execution models
- agent tools should not contain media business logic
- all media jobs should persist through `toolRun`
- all media outputs should be normalized into `mediaAsset` and/or `toolArtifact`

Important nuance:

- KIE is the **default backend**
- the architecture should remain **provider-adaptable**
- KIE-specific logic should stay behind service boundaries

That keeps maintenance simple now without hard-locking the product forever.

---

## Why This Change

Today, Vaja has mixed execution models:

- `features/image/service.ts` already uses KIE task creation and `toolRun`
- `features/video/service.ts`, `features/audio/service.ts`, and `features/speech/service.ts` already follow the same async pattern
- but `app/api/chat/route.ts` still contains a direct blocking image path for image-only models

That split creates product and code problems:

- users cannot rely on one consistent generation UX
- some image requests return immediately and poll
- some image requests block until the provider finishes
- stacked image requests are harder to support cleanly
- observability is fragmented
- retries and failures behave differently depending on route

Using one KIE-style job model fixes the above and aligns chat, tools, and agents.

---

## Product Outcome

After this implementation:

- every media request starts quickly
- chat can continue immediately after a media request is queued
- multiple media requests can be stacked cleanly
- pending jobs appear consistently in chat and tool pages
- completion, failure, timeout, and persistence all use the same lifecycle
- the admin and audit surfaces can inspect one unified run ledger

---

## Scope

In scope:

- chat media generation
- agent-triggered media generation
- tool page media generation
- persistence and polling
- callbacks and status reconciliation
- media result hydration inside thread messages

Out of scope for the first pass:

- replacing non-media text providers
- redesigning the entire model registry
- removing all non-KIE model definitions from the codebase immediately
- advanced job orchestration like priorities or cancellation queues

---

## Target Architecture

### Canonical Flow

```text
User request
  -> canonical media service
    -> provider adapter creates KIE task
      -> insert toolRun(status = pending)
        -> return generationId + taskId immediately
          -> UI shows pending state
            -> callback and/or polling resolves status
              -> persist output to R2
                -> write outputJson + mediaAsset/toolArtifact
                  -> hydrate result in chat/tool UI
```

### Rule

**No route should call a blocking provider image/video/audio generation method directly when the user-facing action is a media job.**

Instead:

- route -> service
- service -> KIE task
- UI polls or receives hydrated completion later

---

## Current Reusable Foundation

These parts already exist and should be reused, not rewritten:

- [features/image/service.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/image/service.ts)
- [features/video/service.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/video/service.ts)
- [features/audio/service.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/audio/service.ts)
- [features/speech/service.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/speech/service.ts)
- [lib/providers/kieService.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/lib/providers/kieService.ts)
- [app/api/generate/status/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/generate/status/route.ts)
- [app/api/kie/callback/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/kie/callback/route.ts)
- [lib/generation/persist-tool-run-output.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/lib/generation/persist-tool-run-output.ts)
- [app/api/threads/[threadId]/messages/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/threads/[threadId]/messages/route.ts)
- [db/schema/tools.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/db/schema/tools.ts)

This is good news: the platform already has most of the async-job primitives.

---

## Architecture Rules

### 1. One Canonical Service Per Media Feature

Each media domain keeps one canonical `service.ts`.

Examples:

- image: `features/image/service.ts`
- video: `features/video/service.ts`
- audio: `features/audio/service.ts`
- speech: `features/speech/service.ts`

Every caller uses that service:

- API routes
- agent adapters
- chat orchestration
- tool pages

Do not duplicate KIE task creation logic in routes.

### 2. Chat Must Not Generate Media Directly

`app/api/chat/route.ts` should stop doing blocking provider image generation.

Instead, chat should:

- detect media intent
- call the canonical media service
- emit a pending tool/file message shape
- return immediately

### 3. `toolRun` Is The Job Ledger

Use `toolRun` as the shared execution record for all media jobs.

Minimum fields already useful today:

- `toolSlug`
- `userId`
- `threadId`
- `source`
- `inputJson`
- `status`
- `outputJson`
- `errorMessage`
- `createdAt`
- `completedAt`

### 4. Persist Outputs Once

Provider output URLs should be normalized into permanent storage once a run completes.

Use:

- `mediaAsset` for chat-visible generated media
- `toolArtifact` where artifact semantics are more appropriate

Do not let temporary provider URLs become the product contract long-term.

### 5. UI Should Only Care About Job State

The UI should not care whether the provider is KIE image, KIE video, Suno, or anything else.

It should only care about:

- pending
- success
- failed
- timeout

and a normalized output payload.

---

## Recommended Implementation Phases

## Phase 1: Unify Chat Image Generation Behind Async Jobs ✅

### Goal

Remove blocking image generation from chat and route all chat image work through `features/image/service.ts`.

### Changes

- `app/api/chat/route.ts` — removed blocking `generateImage()` path; added `mapToKieImageModel()` helper; emits `tool-input-available` + `tool-output-available` via UIMessageStream; uses `onFinish` for persistence
- `features/image/service.ts` — added optional `options?: { threadId?, source? }` param; `toolRun` now records `threadId` and `source: 'chat'` for chat-originated jobs
- Removed `parseImageDataUrl` / `resolveImageAttachmentInput` helpers (no longer needed)

### Result

- image chat is fully async — returns immediately, polls via existing `ImageGenerationToolPart`
- stacked image prompts are first-class
- chat UX is consistent with the KIE tool tool page

---

## Phase 2: Introduce A Shared Media Job Contract ✅

### Goal

Define one shared output shape for media jobs regardless of media type.

### Changes

- `lib/generation/media-job-types.ts` (new) — `MediaJobKind`, `MediaJobStatus`, `MediaJobOutput` types; `toolSlugToMediaKind()` helper; `extractMediaOutputUrls()` replaces the duplicated `getPersistedImageUrls` / `getPersistedThumbnailUrls` helpers
- `app/api/threads/[threadId]/messages/route.ts` — replaced `isGenerateImageToolPart` with `isMediaGenerationToolPart` (covers `generate_image`, `generate_video`, `generate_music`, `generate_speech`); replaced local URL helpers with `extractMediaOutputUrls` from the shared contract
- `features/video/service.ts` — added optional `options?: { threadId?, source? }` param (consistent with image service)
- `features/audio/service.ts` — same
- `features/speech/service.ts` — same for both `triggerSpeechGeneration` and `triggerDialogueGeneration`

---

## Phase 3: Normalize Chat Rendering ✅

### Goal

Render media jobs in chat through one predictable pattern.

### Recommended UX

- assistant message appears immediately with pending state
- message upgrades itself when output is ready
- user can continue sending prompts while jobs are still pending
- image/video/audio outputs expose the same core actions:
  - open
  - download
  - use in next chat (images)
  - branch/edit when supported

### Changes

- `components/message-renderer/types.ts`:
  - Added `MediaGenerationKind = 'image' | 'video' | 'audio'` type
  - Added `MediaGenerationToolOutput` alias (same fields as `ImageGenerationToolOutput`; works for all media kinds after thread hydration writes `imageUrls` universally)
  - Added `isMediaGenerationToolName()` — covers `generate_image`, `generate_video`, `generate_music`, `generate_speech`
  - Added `isMediaGenerationToolOutput()` — wraps the same check as image version
  - Added `toolNameToMediaKind()` — maps tool name to rendering kind
- `components/message-renderer/parts/media-generation-tool-part.tsx` (new):
  - `MediaGenerationToolPart` — dispatches by `kind`
  - `kind === 'image'`: delegates to `ImageGenerationToolPart` (preserves full image UX)
  - `kind === 'video'`: pending spinner → `<video controls>` card with open/download
  - `kind === 'audio'`: pending spinner → `<audio controls>` card per track with download
  - Shared `PendingCard` and `ErrorCard` used for video/audio kinds
  - All kinds use `useGenerationPoll` for the same polling/state lifecycle
- `components/message-renderer/message-part-renderer.tsx`:
  - Replaced `isImageGenerationToolName` + `isImageGenerationToolOutput` + `ImageGenerationToolPart` with the generalized versions
  - `generate_video`, `generate_music`, `generate_speech` now render through `MediaGenerationToolPart` instead of falling through to the raw JSON `Tool` panel

---

## Phase 4: Add A Shared Media Job Utility Layer ✅

### Goal

Stop duplicating recurring job behavior across image/video/audio/speech services.

### Changes

- `lib/generation/create-media-run.ts` (new) — `createMediaRun({ toolSlug, userId, inputJson, threadId?, source? }) → Promise<{ generationId }>` — single `db.insert(toolRun)` call shared by all four services
- `lib/generation/complete-media-run.ts` (new) — `completeMediaRun({ generationId, outputUrl?, outputUrls?, latency?, existingOutputJson?, extra? }) → Promise<void>` — wraps `db.update(toolRun).set({ status: 'success', completedAt, outputJson })`
- `lib/generation/fail-media-run.ts` (new) — `failMediaRun({ generationId, errorMessage, existingOutputJson?, extra? }) → Promise<void>` — wraps `db.update(toolRun).set({ status: 'error', errorMessage, outputJson })`
- `features/image/service.ts` — replaced `nanoid` + `db.insert(toolRun)` block with `createMediaRun()`
- `features/video/service.ts` — same
- `features/audio/service.ts` — same
- `features/speech/service.ts` — same for both `triggerSpeechGeneration` and `triggerDialogueGeneration`
- `app/api/kie/callback/route.ts` — replaced inline `db.update(toolRun)` success/failure blocks with `completeMediaRun()` / `failMediaRun()`
- `app/api/generate/status/route.ts` — same

### Result

- `db.insert(toolRun)` and `db.update(toolRun)` patterns exist in exactly one place each
- adding a new media type requires only calling these three utilities — no DB boilerplate
- `extra` param in `completeMediaRun` / `failMediaRun` carries caller-specific fields (`callbackReceived`, `audioMeta`) without polluting the shared interface

---

## Phase 5: Optional Provider Adapter Boundary ✅

### Goal

Keep KIE as default without baking provider-specific assumptions into product logic.

### Changes

- `lib/providers/media/types.ts` (new) — `MediaTaskResult = { taskId: string }` shared contract
- `lib/providers/media/kie-image-adapter.ts` (new) — `buildKieInput()` (moved from `features/image/service.ts`) + `createKieImageTask(params, apiKey, callbackUrl)` → wraps `KieService.createTask`
- `lib/providers/media/kie-video-adapter.ts` (new) — Veo/standard routing (moved from `features/video/service.ts`) + `createKieVideoTask(params, videoOptions, apiKey, callbackUrl)` → routes to `KieService.createVeoTask` or `KieService.createTask`
- `lib/providers/media/kie-audio-adapter.ts` (new) — `SUNO_MODEL_MAP` (moved from `features/audio/service.ts`) + `createKieAudioTask(params, apiKey)` → wraps `KieService.createSunoTask`; returns `{ taskId, sunoModel }` so the service can log the resolved variant
- `lib/providers/media/kie-speech-adapter.ts` (new) — `createKieTtsTask(params, apiKey, callbackUrl)` and `createKieDialogueTask(params, apiKey, callbackUrl)` → wrap `KieService.createTtsTask` / `KieService.createDialogueTask`
- `features/image/service.ts` — removed `buildKieInput`; replaced `KieService.createTask` call with `createKieImageTask`
- `features/video/service.ts` — removed 50-line Veo/standard routing block; replaced with single `createKieVideoTask` call
- `features/audio/service.ts` — removed `SUNO_MODEL_MAP`; replaced `KieService.createSunoTask` call with `createKieAudioTask`
- `features/speech/service.ts` — replaced `KieService.createTtsTask` / `KieService.createDialogueTask` calls with adapter equivalents

### Result

- No feature service imports `KieService` directly — all KIE API details live in `lib/providers/media/`
- Swapping any media type to a different provider means touching one adapter file only
- `callbackUrl: string | null` is accepted everywhere; adapters forward it to `KieService` which already supports nullable callbacks

---

## File-by-File Refactor Map

### Primary files to change first

- [app/api/chat/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/chat/route.ts)
  - remove direct blocking media generation
  - emit async job-backed chat messages

- [features/image/service.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/image/service.ts)
  - remain the canonical chat/tool/agent entry point for image jobs
  - add any fields chat now needs, such as `threadId`, `source`, or richer input metadata

- [features/image/agent.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/features/image/agent.ts)
  - stay thin
  - only call the service

- [app/api/threads/[threadId]/messages/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/threads/[threadId]/messages/route.ts)
  - keep hydrating pending and completed generation runs into thread-safe UI messages

- [components/message-renderer/parts/image-generation-tool-part.tsx](/abs/path/d:/vscode2/nextjs/ai-sdk/components/message-renderer/parts/image-generation-tool-part.tsx)
  - support the unified pending/success/failure media card experience

### Secondary files likely involved

- [app/api/generate/status/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/generate/status/route.ts)
- [app/api/kie/callback/route.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/app/api/kie/callback/route.ts)
- [lib/generation/persist-tool-run-output.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/lib/generation/persist-tool-run-output.ts)
- [lib/polling/GenerationPollingService.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/lib/polling/GenerationPollingService.ts)
- [db/schema/tools.ts](/abs/path/d:/vscode2/nextjs/ai-sdk/db/schema/tools.ts)

---

## Data Model Recommendations

The current `toolRun` table is good enough for the first migration.

Recommended additions only if needed:

- `provider` or `provider_family` in `inputJson`
- `taskKind` in `inputJson`
- `origin` in `inputJson`
  - `chat`
  - `tool_page`
  - `agent`
  - `line`
- normalized output summary in `outputJson`

Avoid adding new tables before the current shared ledger proves insufficient.

---

## UX Requirements

The migration is only successful if the UX improves, not just the code.

Required outcomes:

- user can submit multiple media prompts consecutively
- user does not lose composer usability while media jobs are pending
- pending jobs are visually obvious
- failures are recoverable and understandable
- completed outputs are reusable in the next prompt
- implicit “edit the last image” flow still works

If an architecture choice makes these worse, it is the wrong tradeoff.

---

## Risks

### 1. KIE Platform Dependency

Risk:

- outages, pricing changes, or capability gaps affect all media generation

Mitigation:

- isolate KIE in service/adapter boundaries
- keep output contracts provider-neutral

### 2. Chat Migration Complexity

Risk:

- chat currently mixes model routing and direct media logic

Mitigation:

- migrate image-only routing first
- do not refactor text chat at the same time

### 3. Output Contract Drift

Risk:

- different services serialize different `outputJson` shapes

Mitigation:

- define a shared media job payload before broad rollout

---

## Explicit Non-Goals

Do not do these in the first pass:

- rebuild all model-selection UX
- delete all legacy model definitions immediately
- move text chat to KIE
- add a full-blown external queue system unless KIE task/callback + polling proves insufficient

Keep the first refactor narrow and high-leverage.

---

## Recommended Sequence

1. Convert chat image generation to use `features/image/service.ts` only.
2. Standardize pending media message hydration in thread APIs.
3. Normalize image job output payload shape.
4. Audit video/audio/speech services for contract consistency.
5. Extract shared media-run utilities.
6. Add adapter boundaries only after the unified path works.

---

## Final Recommendation

For Vaja, **using KIE as the canonical async backend for all media generation is practical and worth doing**.

It is the simplest way to achieve:

- consistent UX
- stacked media jobs
- reliable persistence
- easier debugging
- lower maintenance overhead

The correct long-term architecture is:

**one async media job system, one canonical service per media feature, KIE as the default executor behind that system.**

That is the path this document recommends.
