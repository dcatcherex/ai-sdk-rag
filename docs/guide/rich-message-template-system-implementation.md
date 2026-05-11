# Rich Message Template System Implementation Guide

Status: implementation in progress  
Last updated: 2026-05-11  
Audience: AI coders, backend developers, frontend developers, and product engineers  

## Purpose

Build a long-term "create once, render everywhere" rich message system for Vaja.

The current platform has LINE Flex templates, a LINE Flex preview component, and a response-format layer that can choose template keys such as `agriculture.diagnosis`. The gap is that LINE Flex JSON is still too close to one channel. We need one canonical Vaja rich message template format that can render to:

- LINE Flex Message in LINE OA
- rich card in normal web chat
- admin preview
- future channels such as email, PDF export, WhatsApp, Messenger, and notifications

This document defines the target architecture and phased checkpoints.

## Progress Snapshot

Implementation progress as of 2026-05-11:

- Phase 0 is complete: module boundaries are now established across `features/rich-messages/`, `features/response-format/`, and `features/line-oa/`.
- Phase 1 is substantially complete: the canonical `features/rich-messages/` module exists with types, schemas, registry, interpolation, fallback generation, and service-level validation/rendering.
- Phase 2 is complete for the current template set: shared LINE and web adapters now render the same `RichMessageInstance`.
- Phase 3 is complete for the migrated template path: web chat can render `data-rich-message` parts and includes fallback text for copy and persistence flows.
- Phase 4 is complete for the migrated template path: LINE rendering now prefers the canonical rich-message path before falling back to legacy response-template rendering.
- Phase 5 is complete: response-format now selects `templateKey` and `data`, and migrated templates render through the canonical rich-message service plus shared adapters instead of separate channel-specific template implementations.
- Phase 6 is complete for the code-backed catalog stage: admins can browse canonical rich templates through `/admin/rich-message-templates`, inspect sample data, compare web and LINE output, inspect fallback/instance/payload JSON, and load the catalog through an admin API.
- Phase 7 is complete from the application/runtime perspective: persisted rich templates now have schema/migration support, admin CRUD routes, mixed-source admin catalog support, and published database-backed templates resolve through the same rich-message runtime path used by web chat and LINE.
- Phase 8 is complete for the intended architecture checkpoint: canonical rich templates are the primary message system, linked LINE Flex overrides work at runtime, and admin surfaces now distinguish cross-channel templates from LINE-specific assets.

Current working status:

- Canonical runtime path exists and is usable.
- Common and agriculture templates are the first supported domain set.
- Admin preview/catalog is now mixed-source: built-in templates come from code, and database-backed templates can be listed, previewed, published, archived, and deleted through the same admin surface/API.
- Legacy Flex and response-template compatibility layers are still present by design.
- Published database-backed rich templates can now resolve through the server runtime path for web finalization and LINE rendering.
- The Phase 8 plan now defines the best-practice target: one `Message Templates` catalog where LINE Flex is a generated output, optional LINE override, or explicit `LINE-only` asset.
- Phase 8 is now complete in code: `line_flex_template` supports `templateType` plus `richTemplateKey`, LINE runtime can prefer linked published overrides, and admin surfaces now present `Message Templates` as the primary catalog with a separate LINE-assets view and a compatibility LINE Flex editor.

Read together with:

- `docs/response-format-orchestration-implementation.md`
- `docs/skill-defined-task-flows-implementation.md`
- `docs/line-oa-dev-guide.md`
- `docs/contest/flex-message-feature-plan.md`
- `docs/contest/agrispark-flex-message-implementation.md`
- `docs/vaja-vision.md`

## Product Goal

A developer or AI coder should be able to define one template:

```ts
{
  key: "agriculture.diagnosis",
  title: "Agriculture Diagnosis",
  intent: "diagnosis",
  schema: diagnosisDataSchema,
  layout: {
    type: "card",
    tone: "success",
    title: "{{crop_name}}",
    eyebrow: "ผลการวินิจฉัย",
    sections: [
      { label: "โรค/แมลง", value: "{{diagnosis}}" },
      { label: "ระดับความเสี่ยง", value: "{{severity}}", toneFrom: "severity" },
      { label: "วิธีแก้ไข", value: "{{recommendation}}" }
    ],
    actions: [
      { label: "บันทึกผล", kind: "postback", value: "save_diagnosis" }
    ]
  }
}
```

Then the platform can render it as:

- `FlexMessage` for LINE
- React rich card for web chat
- approximate preview in admin
- plain text fallback for unsupported channels

## Core Principle

Tools and agents produce structured business results. Channels decide how to display them.

Do not let tool logic build LINE Flex JSON directly. Do not let web chat invent a separate visual template for the same business result.

Correct flow:

```txt
Tool / agent / response-format selector
        ↓
RichMessageInput
        ↓
features/rich-messages/service.ts
        ↓
RichMessageInstance
        ↓
Channel adapters
        ├─ LINE Flex Message
        ├─ Web chat card
        └─ Plain text fallback
```

## Non-Goals

- Do not replace LINE Rich Menu. Rich Menu is persistent navigation; Rich Message is per-message content.
- Do not remove existing Flex templates immediately.
- Do not require every assistant response to become a card.
- Do not put domain-specific agriculture rules in the platform core.
- Do not import server-only template services in client components.

## Current State

Implemented now:

- `features/rich-messages/` exists and is the canonical module for migrated templates.
- `renderRichMessage()` validates, interpolates, and produces a `RichMessageInstance`.
- Shared LINE and web adapters render the same instance.
- Web chat stores and renders `data-rich-message` parts.
- LINE response rendering prefers canonical rich-message rendering first.
- A code-backed admin preview page exists at `/admin/rich-message-templates`.
- Common templates and the main agriculture templates are migrated:
  - `common.confirmation`
  - `common.summary`
  - `common.approval_request`
  - `common.escalation`
  - `agriculture.diagnosis`
  - `agriculture.weather_risk`
  - `agriculture.forecast_7day`
  - `agriculture.record_entry`
  - `agriculture.record_confirmation`
  - `agriculture.weekly_summary`

Useful existing files:

- `features/response-format/types.ts`
- `features/response-format/server/select.ts`
- `features/response-format/template-registry.ts`
- `features/response-format/templates/common.ts`
- `features/response-format/templates/agriculture.ts`
- `features/response-format/templates/shared.ts`
- `features/line-oa/flex/components/flex-preview.tsx`
- `features/line-oa/flex/seeds/agrispark-templates.ts`
- `features/line-oa/flex/types.ts`
- `features/line-oa/webhook/flex/reply.ts`
- `db/schema/line-oa.ts`
- `app/api/admin/flex-templates/route.ts`
- `app/api/line-oa/flex-templates/route.ts`
- `components/message-renderer/message-part-renderer.tsx`
- `features/chat/server/finalization-helpers.ts`
- `features/rich-messages/service.ts`
- `features/rich-messages/registry.ts`
- `features/rich-messages/templates/common.ts`
- `features/rich-messages/templates/agriculture.ts`
- `features/rich-messages/adapters/line.ts`
- `features/rich-messages/adapters/web.ts`
- `features/rich-messages/sample-data.ts`
- `app/admin/rich-message-templates/page.tsx`

Current limitation:

- The admin rich-template surface is still stronger as a preview/inspection console than as a full visual editor for authoring layouts from scratch.
- Legacy Flex templates are still the richer editor experience for custom LINE-only payloads.
- Template management is still split between canonical rich templates and legacy LINE-only Flex templates.
- On this local environment, `pnpm drizzle-kit migrate` hit an existing `drizzle.__drizzle_migrations` primary-key conflict. The generated migration file is correct, but DB apply state may need cleanup before deployment/database rollout.

Best-practice direction for the two template limitations:

- Canonical rich templates should become the main system of record for business meaning, schema, fallback text, status, and lifecycle.
- LINE Flex JSON should become a channel output, or an optional channel-specific override attached to a canonical template.
- The admin product should expose one primary catalog: `Message Templates`.
- Existing LINE-only Flex templates should remain supported, but should be clearly marked as `LINE-only` and excluded from normal web chat rendering.
- AI tools and response-format selection should return `templateKey` plus structured `data`; they should not return raw Flex JSON except for deliberately LINE-only capabilities.

Target management model:

```txt
Message Template
  ├─ canonical schema/data/layout
  ├─ web renderer
  ├─ generated LINE Flex renderer
  └─ channel overrides
       └─ LINE custom Flex JSON
```

Template types in the unified catalog:

- `Cross-channel`: canonical rich template that renders in web chat and LINE.
- `Cross-channel with LINE override`: canonical rich template for shared meaning, custom Flex JSON for LINE presentation.
- `LINE-only`: raw Flex template for LINE-native campaigns, postbacks, coupons, or channel-specific experiences that do not make sense in web chat.

Target:

- Move source-of-truth template definitions to `features/rich-messages/`.
- Keep `features/response-format/` responsible for selection/orchestration.
- Keep `features/line-oa/` responsible for LINE transport and LINE-specific rendering.
- Make web chat able to render the same `RichMessageInstance`.

## Proposed Module

Add:

```txt
features/rich-messages/
  types.ts
  schema.ts
  service.ts
  registry.ts
  interpolation.ts
  fallback.ts
  adapters/
    line.ts
    web.ts
  templates/
    common.ts
    agriculture.ts
  components/
    rich-message-card.tsx
    rich-message-part.tsx
    rich-message-preview.tsx
  tests/
    service.test.ts
    line-adapter.test.ts
    web-adapter.test.ts
```

Optional later:

```txt
app/api/admin/rich-message-templates/
app/admin/rich-message-templates/
db/schema/rich-messages.ts
```

For phase 1, code-backed templates are enough. Add database-backed templates only when the runtime path is stable.

## Type Model

### Channel

```ts
export type RichMessageChannel =
  | "line"
  | "web"
  | "email"
  | "plain_text";
```

### Template

```ts
import type { z } from "zod";
import type { ResponseIntent } from "@/features/response-format/types";

export type RichMessageTemplate<TData extends Record<string, unknown> = Record<string, unknown>> = {
  key: string;
  title: string;
  description?: string;
  category: "common" | "agriculture" | "education" | "clinic" | "sales" | "creator" | "other";
  intent: ResponseIntent;
  schema: z.ZodType<TData>;
  supportedChannels: RichMessageChannel[];
  layout: RichMessageLayout;
  fallback: RichMessageFallbackConfig;
};
```

### Layout

Keep the canonical layout smaller and more semantic than LINE Flex:

```ts
export type RichMessageTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type RichMessageLayout = {
  type: "card" | "summary" | "alert" | "receipt" | "carousel";
  tone?: RichMessageTone;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  media?: RichMessageMedia;
  sections?: RichMessageSection[];
  metrics?: RichMessageMetric[];
  actions?: RichMessageAction[];
  items?: RichMessageLayout[];
};

export type RichMessageSection = {
  key?: string;
  label: string;
  value: string;
  tone?: RichMessageTone;
  toneFrom?: string;
  maxLines?: number;
};

export type RichMessageMetric = {
  label: string;
  value: string;
  unit?: string;
  tone?: RichMessageTone;
};

export type RichMessageAction = {
  label: string;
  kind: "message" | "postback" | "uri" | "copy" | "tool";
  value: string;
  style?: "primary" | "secondary" | "danger";
};

export type RichMessageMedia = {
  kind: "image";
  url: string;
  alt?: string;
  aspectRatio?: "1:1" | "4:3" | "16:9" | "20:13";
};
```

### Rendered Instance

```ts
export type RichMessageInstance = {
  kind: "rich_message";
  templateKey: string;
  intent: ResponseIntent;
  altText: string;
  fallbackText: string;
  data: Record<string, unknown>;
  resolvedLayout: RichMessageLayout;
  metadata?: Record<string, unknown>;
};
```

The `resolvedLayout` is the interpolated layout after replacing `{{field}}` values. Message renderers should consume the instance, not raw template definitions.

## Service API

Create `features/rich-messages/service.ts`.

```ts
export type RenderRichMessageInput = {
  templateKey: string;
  data: Record<string, unknown>;
  channel?: RichMessageChannel;
  locale?: string;
  metadata?: Record<string, unknown>;
};

export type RenderRichMessageResult =
  | { ok: true; instance: RichMessageInstance }
  | { ok: false; error: "template_not_found" | "unsupported_channel" | "invalid_data"; issues?: string[] };

export function renderRichMessage(input: RenderRichMessageInput): RenderRichMessageResult;
```

Rules:

- `renderRichMessage()` validates `data` against the template Zod schema.
- It interpolates every layout string with `{{field}}`.
- It generates a deterministic `fallbackText`.
- It returns an instance independent from React and LINE SDKs.
- It never talks to the database.
- It never imports LINE webhook code.

## Registry API

Create `features/rich-messages/registry.ts`.

```ts
export function listRichMessageTemplates(): RichMessageTemplate[];
export function getRichMessageTemplate(key: string): RichMessageTemplate | null;
export function hasRichMessageTemplate(key: string): boolean;
```

Registry should initially be code-backed:

```ts
const RICH_MESSAGE_TEMPLATES = [
  ...COMMON_RICH_MESSAGE_TEMPLATES,
  ...AGRICULTURE_RICH_MESSAGE_TEMPLATES,
];
```

Do not read admin-created templates directly from client components. Add server APIs when database-backed templates are needed.

## Adapter Contracts

### LINE Adapter

Create `features/rich-messages/adapters/line.ts`.

```ts
import type { FlexMessage } from "@/features/line-oa/webhook/types";

export function renderRichMessageForLine(instance: RichMessageInstance): FlexMessage;
```

Responsibilities:

- Convert canonical card layout to LINE Flex JSON.
- Enforce LINE text length limits.
- Convert actions to LINE actions.
- Preserve `altText`.
- Fall back to a simple Flex bubble if layout type is unknown.

Do not call LINE Messaging API here. This adapter only renders JSON.

### Web Adapter

Create `features/rich-messages/adapters/web.ts`.

```ts
export type WebRichMessageViewModel = {
  tone: RichMessageTone;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  sections: Array<{ label: string; value: string; tone?: RichMessageTone }>;
  metrics: Array<{ label: string; value: string; unit?: string; tone?: RichMessageTone }>;
  actions: RichMessageAction[];
  media?: RichMessageMedia;
};

export function renderRichMessageForWeb(instance: RichMessageInstance): WebRichMessageViewModel;
```

React components should render the web view model, not the raw template.

### Plain Text Fallback

Create `features/rich-messages/fallback.ts`.

```ts
export function buildRichMessageFallbackText(instance: RichMessageInstance): string;
```

Use this for:

- model logs
- copy button fallback
- unsupported channels
- accessibility fallback
- old clients

## Message Part Integration

Add a UI message part for rich messages:

```ts
export type RichMessageUIPart = {
  type: "data-rich-message";
  data: RichMessageInstance;
};
```

Integrate in:

- `features/chat/types.ts`
- `components/message-renderer/message-part-renderer.tsx`
- `features/chat/utils/message-parts.ts`
- persistence/hydration paths if message parts are normalized elsewhere

Renderer path:

```tsx
if (part.type === "data-rich-message") {
  return <RichMessagePart instance={part.data} />;
}
```

Copy behavior:

- `getTextContentFromParts()` should include `instance.fallbackText`.
- Message toolbar copy should still work.

## Response-Format Integration

The response-format layer should select a rich message template but not render a channel-specific payload.

Change `ResponseCard` gradually from:

```ts
export type ResponseCard = {
  templateKey: string;
  altText: string;
  data: Record<string, unknown>;
  fallbackText: string;
};
```

To:

```ts
export type ResponseCard = {
  templateKey: string;
  altText: string;
  data: Record<string, unknown>;
  fallbackText: string;
  richMessage?: RichMessageInstance;
};
```

Checkpoint rule:

- Phase 1 may keep `ResponseCard` as-is.
- Phase 2 should populate `richMessage`.
- Phase 3 should make renderers prefer `richMessage` and use legacy card fields only as fallback.

In `features/chat/server/finalization-helpers.ts`, after `buildResponsePlan()`:

```ts
if (responsePlan.card) {
  const rendered = renderRichMessage({
    templateKey: responsePlan.card.templateKey,
    data: responsePlan.card.data,
    channel: "web",
    locale,
  });

  if (rendered.ok) {
    addRichMessagePartToAssistantMessage(rendered.instance);
  }
}
```

Keep metadata audit:

- `responseFormat.templateKey`
- `responseFormat.responseFormats`
- `responseFormat.renderFallbackUsed`

## LINE Integration

LINE webhook should render through rich messages when a response plan contains a card.

Target flow:

```ts
const plan = buildResponsePlan({ text, userText, toolResults, locale });

if (plan.card) {
  const rich = renderRichMessage({
    templateKey: plan.card.templateKey,
    data: plan.card.data,
    channel: "line",
    locale,
  });

  if (rich.ok) {
    return [renderRichMessageForLine(rich.instance)];
  }
}

return buildReplyMessages(text, sender, quickReply);
```

Likely call sites:

- `features/line-oa/webhook/events/message.ts`
- `features/line-oa/webhook/events/reply-helpers.ts`
- `features/line-oa/webhook/flex/reply.ts`

Keep generic Flex reply as fallback.

## Admin Template Direction

Existing admin route:

- `app/admin/flex-templates/page.tsx`
- `app/api/admin/flex-templates/route.ts`
- `app/api/admin/flex-templates/[id]/route.ts`
- `lineFlexTemplate`

Earlier rich-template admin direction:

```txt
Rich Templates
  ├─ canonical layout editor
  ├─ data schema editor / sample data
  ├─ web preview
  ├─ LINE preview
  └─ publish status
```

Best-practice admin target:

```txt
Message Templates
  ├─ canonical layout editor
  ├─ data schema editor / sample data
  ├─ web preview
  ├─ LINE preview
  ├─ optional LINE Flex override editor
  ├─ LINE-only Flex import/export
  └─ publish status
```

Do not delete Flex Templates immediately. Instead:

1. Add `richMessageTemplate` as the new canonical concept.
2. Add a relationship from legacy/custom Flex templates to a canonical `richTemplateKey` when the Flex payload is acting as a LINE override.
3. Keep truly LINE-only templates available, but label them as channel-specific assets rather than cross-channel message templates.
4. Add a migration path from selected Flex templates into semantic layouts.

Suggested database table for a later phase:

```ts
richMessageTemplate
  id
  key
  title
  description
  category
  intent
  schemaJson
  layoutJson
  fallbackJson
  supportedChannels
  catalogStatus
  createdBy
  publishedAt
  createdAt
  updatedAt
```

Phase 7 has now added this table. Phase 8 should add the linking/override layer that lets a canonical template own optional LINE-specific Flex JSON without making that Flex JSON the source of truth.

## Phased Implementation Plan

### Phase 0 - Alignment Checkpoint

Goal: confirm boundaries before code.

Tasks:

- Read this document and `docs/response-format-orchestration-implementation.md`.
- Confirm `features/rich-messages/` is the canonical module.
- Confirm `features/response-format/` selects templates but does not own channel rendering.
- Confirm `features/line-oa/` only handles LINE transport and LINE adapter output.

Checkpoint:

- A developer can explain the difference between ResponsePlan, RichMessageTemplate, RichMessageInstance, and LINE FlexMessage.

Exit criteria:

- No code required.

### Phase 1 - Code-Backed Rich Message Core

Goal: create the canonical template module without changing runtime behavior.

Files to add:

- `features/rich-messages/types.ts`
- `features/rich-messages/schema.ts`
- `features/rich-messages/interpolation.ts`
- `features/rich-messages/fallback.ts`
- `features/rich-messages/registry.ts`
- `features/rich-messages/service.ts`
- `features/rich-messages/templates/common.ts`
- `features/rich-messages/templates/agriculture.ts`
- `features/rich-messages/tests/service.test.ts`

Initial templates:

- `common.confirmation`
- `common.summary`
- `common.approval_request`
- `common.escalation`
- `agriculture.diagnosis`
- `agriculture.weather_risk`
- `agriculture.record_entry`
- `agriculture.record_confirmation`
- `agriculture.weekly_summary`

Checkpoint:

- `renderRichMessage({ templateKey: "agriculture.diagnosis", data })` returns a validated `RichMessageInstance`.
- Invalid data returns `{ ok: false, error: "invalid_data" }`.
- No LINE or React imports exist in `service.ts`.

Progress:

- Complete for the current migrated template set.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm test -- rich-messages
```

### Phase 2 - Channel Adapters

Goal: render the same instance to LINE and web view models.

Files to add:

- `features/rich-messages/adapters/line.ts`
- `features/rich-messages/adapters/web.ts`
- `features/rich-messages/tests/line-adapter.test.ts`
- `features/rich-messages/tests/web-adapter.test.ts`

Files to reuse:

- `features/line-oa/webhook/types.ts`
- `features/line-oa/flex/components/flex-preview.tsx`

Checkpoint:

- `renderRichMessageForLine(instance)` returns `FlexMessage`.
- `renderRichMessageForWeb(instance)` returns a channel-neutral view model.
- The same `RichMessageInstance` produces both outputs.

Progress:

- Complete for the current migrated template set.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm test -- rich-messages
```

### Phase 3 - Web Chat Rich Message Rendering

Goal: normal chat can display rich messages from the canonical system.

Files to add:

- `features/rich-messages/components/rich-message-card.tsx`
- `features/rich-messages/components/rich-message-part.tsx`
- `features/rich-messages/components/rich-message-preview.tsx`

Files to update:

- `features/chat/types.ts`
- `features/chat/utils/message-parts.ts`
- `components/message-renderer/message-part-renderer.tsx`
- `features/chat/server/finalization-helpers.ts`
- message persistence/hydration files if needed:
  - `features/chat/server/message-persistence.ts`
  - `features/chat/server/message-hydration.ts`

Checkpoint:

- Assistant messages can include both text and `data-rich-message` parts.
- Web chat renders the card.
- Copy button uses fallback text.
- Existing plain text messages still render unchanged.

Progress:

- Complete for migrated rich-message cards.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm test -- message-persistence
```

Manual check:

- Ask for a Thai agriculture diagnosis.
- Confirm the assistant message includes a rich card plus usable text fallback.
- Confirm mobile width does not overflow.

### Phase 4 - LINE Runtime Integration

Goal: LINE uses the same rich message template output.

Files to update:

- `features/line-oa/webhook/events/message.ts`
- `features/line-oa/webhook/events/reply-helpers.ts`
- `features/line-oa/webhook/flex/reply.ts`
- `features/response-format/server/select.ts`

Checkpoint:

- When `ResponsePlan.card.templateKey` maps to a rich template, LINE replies with `renderRichMessageForLine(instance)`.
- When rendering fails, LINE falls back to existing `buildReplyMessages()`.
- Quick replies still work.
- Existing welcome Flex and Rich Menu behavior are unchanged.

Progress:

- Complete for migrated rich-message cards.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm test -- response-format
```

Manual check:

- Send a LINE-style diagnosis message.
- Confirm the reply is a Flex Message.
- Confirm the same data renders correctly in web chat.

### Phase 5 - Response-Format Cleanup

Goal: remove duplicate template rendering from `features/response-format/templates/*`.

Files to update:

- `features/response-format/types.ts`
- `features/response-format/template-registry.ts`
- `features/response-format/templates/common.ts`
- `features/response-format/templates/agriculture.ts`
- `features/response-format/server/audit.ts`
- `features/response-format/server/select.ts`

Target behavior:

- Response-format selects `templateKey` and `data`.
- Rich-message service validates and renders.
- LINE/web adapters live only in `features/rich-messages/adapters`.

Checkpoint:

- No template has separate hand-written `renderLine()` and `renderWeb()` unless there is a temporary migration reason.
- Agriculture no longer relies on seeded LINE Flex payloads as the canonical template.
- `features/line-oa/flex/seeds/agrispark-templates.ts` is legacy/admin seed data, not runtime source of truth.

Progress:

- Complete.
- Response-format metadata still exists in `features/response-format/template-registry.ts`, but migrated templates no longer depend on separate `renderLine()` / `renderWeb()` implementations.
- `renderResponseForLine()` and `renderResponseForWeb()` now treat the canonical rich-message service as the primary rendering path.
- The legacy response-template registry remains as metadata for orchestration and validation, not as a second rendering system.
- `features/line-oa/flex/seeds/agrispark-templates.ts` is still useful for legacy admin/Flex tooling and should not be removed yet.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm test -- response-format
pnpm test -- rich-messages
```

### Phase 6 - Admin Preview and Template Catalog

Goal: developers/admins can preview canonical rich templates across channels.

Files to add or update:

- `app/admin/rich-message-templates/page.tsx`
- `app/api/admin/rich-message-templates/route.ts`
- `features/rich-messages/components/rich-message-preview.tsx`
- `features/line-oa/flex/components/flex-preview.tsx`

Initial UI requirements:

- list templates
- select sample data
- preview web rendering
- preview LINE rendering
- show fallback text
- show supported channels

Checkpoint:

- Admin can compare web and LINE output side by side.
- Existing Flex Templates page remains available.

Progress:

- Complete for the code-backed catalog stage.
- A code-backed preview page exists at `/admin/rich-message-templates`.
- An admin API now exists at `/api/admin/rich-message-templates`.
- Current preview supports:
  - template list
  - sample JSON editing
  - side-by-side web preview
  - side-by-side LINE preview
  - fallback text inspection
  - rendered instance JSON inspection
  - generated LINE payload inspection
  - template metadata inspection
  - LINE simulator deep link
- Database-backed rich-template CRUD is not implemented yet.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm dev
```

Manual check:

- Open `/admin/rich-message-templates`.
- Preview `agriculture.diagnosis`.
- Confirm LINE and web previews use the same sample data.

### Phase 7 - Database-Backed Rich Templates

Goal: allow platform-managed templates without code deploys.

Add schema only after Phase 1-6 pass.

Files to update:

- `db/schema/rich-messages.ts` or existing domain schema if preferred
- `db/schema/index.ts`
- `app/api/admin/rich-message-templates/*`
- `features/rich-messages/server/repository.ts`
- `features/rich-messages/server/service.ts`

Commands after schema changes:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm exec tsc --noEmit
```

Checkpoint:

- Code-backed templates and DB-backed templates resolve through the same registry API.
- Duplicate keys are rejected.
- Published templates can be used by runtime.
- Draft templates can be previewed only by admins.

Progress:

- Complete.
- Added `db/schema/rich-messages.ts` and generated `db/migrations/0046_bumpy_emma_frost.sql`.
- Added `features/rich-messages/server/repository.ts`, `features/rich-messages/server/service.ts`, and `features/rich-messages/server/runtime.ts`.
- Added admin CRUD routes under `app/api/admin/rich-message-templates/*`.
- Added persisted-template schema definitions so database-backed templates can be preview-rendered through the canonical rich-message renderer in admin.
- Updated `/admin/rich-message-templates` to show template source/status, database availability, and lifecycle actions for database-backed templates.
- Wired published database-backed templates into the server runtime path used by:
  - `features/chat/server/finalization-helpers.ts`
  - `features/response-format/server/line-render.ts`
  - `features/response-format/channels/web.ts` (server variant)

Checkpoint status:

- Code-backed templates and DB-backed templates resolve through the same rich-message runtime API on the server.
- Duplicate keys are rejected across both built-in and database-backed templates.
- Published templates can be used by runtime.
- Draft templates remain previewable only from admin-protected surfaces.

### Phase 8 - Unified Message Templates and Legacy Flex Migration

Goal: collapse template management into one `Message Templates` product surface. Canonical rich templates become the source of truth. LINE Flex remains available as generated output, an optional LINE override, or a deliberately LINE-only template.

Best-practice rule:

- Prefer `Cross-channel` canonical templates for any business result that should appear in web chat and LINE.
- Use `Cross-channel with LINE override` when LINE needs pixel-level Flex control but the business meaning should stay shared.
- Use `LINE-only` only for LINE-native campaigns, coupons, postbacks, and experiences that do not make sense in web chat.
- Never make raw Flex JSON the canonical shape for a reusable business result.
- Never let general AI tools return raw Flex JSON; tools should return `templateKey` and structured `data`.

Candidates:

- `agrispark-diagnosis-result`
- `agrispark-weather-risk`
- `agrispark-record-entry`
- `agrispark-log-confirm`
- `agrispark-weekly-summary`
- `agrispark-officer-broadcast`

Implementation plan:

1. Add LINE override support.
   - Add a database relationship from a legacy/custom Flex template to `richMessageTemplate.key`.
   - Store override metadata such as `channel: "line"`, `overrideType: "flex_json"`, `status`, and `updatedAt`.
   - Keep generated LINE Flex as the default when no override exists.

2. Update runtime resolution.
   - Resolve canonical rich template first.
   - For LINE only, check whether a published LINE override exists for that `templateKey`.
   - If an override exists, interpolate/validate against the canonical template data and return the custom Flex JSON.
   - If no override exists, use `renderRichMessageForLine(instance)`.
   - Web chat always uses the canonical renderer.

3. Unify admin catalog.
   - Rename or reposition `/admin/rich-message-templates` as the primary `Message Templates` surface.
   - Show source/type badges: `Cross-channel`, `LINE override`, `LINE-only`, `Built-in`, `Database`.
   - Add filters for channel support and lifecycle status.
   - Keep `/admin/flex-templates` as a compatibility route or move its functionality into a `LINE` tab inside `Message Templates`.

4. Add migration/linking actions.
   - Add "Link to rich template" for existing Flex templates.
   - Add "Use as LINE override" for Flex templates whose data placeholders match a canonical schema.
   - Add "Create canonical template from this Flex" only as a guided/manual flow, not an automatic converter.
   - Preserve the original Flex JSON as reference metadata.

5. Tighten authoring policy.
   - New general templates default to canonical `Cross-channel`.
   - New raw Flex templates require an explicit `LINE-only` type or a linked `richTemplateKey`.
   - Published cross-channel templates require schema, fallback text, sample data, and at least one renderer.
   - Published LINE overrides require a valid linked canonical template and a passing LINE preview render.

Suggested schema direction:

```ts
richMessageChannelOverride
  id
  richTemplateKey
  channel              // "line"
  overrideType         // "flex_json"
  payloadJson
  fallbackAltText
  status               // "draft" | "published" | "archived"
  sourceFlexTemplateId
  createdBy
  publishedAt
  createdAt
  updatedAt
```

Checkpoint:

- AgriSpark demo templates use canonical rich-message templates at runtime.
- LINE runtime uses a published LINE override when one is linked to a canonical template.
- Web runtime ignores LINE overrides and still renders from the canonical template.
- Legacy Flex Templates page can still import/export raw Flex JSON, or that capability is available from the unified `Message Templates` surface.
- Admins can clearly tell whether a template is `Cross-channel`, `Cross-channel with LINE override`, or `LINE-only`.

Progress:

- Complete for the Phase 8 checkpoint.
- Added linkage metadata to `line_flex_template`: `templateType` and `richTemplateKey`.
- Added `features/line-oa/flex/linking.ts` to centralize known Flex-to-rich template mappings for seeded AgriSpark templates.
- Updated seed import so known AgriSpark Flex templates are created as `line_override` entries linked to canonical rich template keys when applicable.
- Updated LINE runtime in `features/response-format/server/line-render.ts` to prefer linked published LINE overrides before falling back to generated canonical Flex output.
- Updated admin Flex APIs and `/admin/flex-templates` so templates can be marked as `LINE-only` or `LINE override`, linked to canonical rich templates, and validated before publish.
- Updated `/admin/rich-message-templates` and its API so canonical templates can report linked published LINE overrides.
- Repositioned `/admin/rich-message-templates` as the main `Message Templates` surface and changed admin navigation to point there first.
- Added a `LINE assets` view inside `Message Templates` so admins can inspect linked LINE overrides and explicit LINE-only assets from the primary catalog.
- Kept `/admin/flex-templates` as a compatibility LINE Flex editor for raw payload authoring and migration workflows.
- Future improvements can still deepen the authoring experience, but the Phase 8 architecture checkpoint is now satisfied.

## Testing Strategy

Unit tests:

- template registry returns expected keys
- schema validation rejects missing fields
- interpolation replaces nested layout strings
- fallback text contains title, summary, sections, and actions
- LINE adapter returns valid `type: "flex"`
- Web adapter returns stable view model

Integration tests:

- response-format selector maps tool output to rich template key
- chat finalization adds rich message part
- message persistence round-trips `data-rich-message`
- LINE reply path falls back when rich rendering fails

Manual browser checks:

- web chat desktop and mobile
- admin preview desktop and mobile
- LINE simulator preview for Flex output

Run:

```bash
pnpm exec tsc --noEmit
pnpm test -- rich-messages
pnpm test -- response-format
```

## Acceptance Criteria

The implementation is complete when:

- One canonical rich message template can render to both web chat and LINE.
- Agriculture diagnosis uses the same template key and data in both channels.
- Web chat stores a rich message part with fallback text.
- LINE sends Flex JSON generated from the same rich message instance.
- Existing plain text and generic Flex fallback behavior still works.
- Template rendering is covered by unit tests.
- Admin preview can show at least web and LINE outputs for code-backed templates.
- Template management has a clear target path toward one `Message Templates` catalog, with raw LINE Flex treated as a channel override or explicit `LINE-only` asset.

## Common Mistakes

- Do not make LINE Flex JSON the canonical template shape.
- Do not add business/domain logic to `agent.ts`.
- Do not import `features/line-oa/webhook/*` into web chat components.
- Do not import React components into `features/rich-messages/service.ts`.
- Do not let tools return JSX, Flex JSON, or HTML.
- Do not skip Zod validation for template data.
- Do not store only rendered output if the original template key and data are needed for audit/debugging.

## Recommended First Vertical Slice

Build the smallest useful end-to-end slice:

1. Add `agriculture.diagnosis` to `features/rich-messages/templates/agriculture.ts`.
2. Add `renderRichMessage()`.
3. Add LINE and web adapters.
4. Add web chat `data-rich-message` renderer.
5. Wire `features/chat/server/finalization-helpers.ts` for diagnosis cards.
6. Wire LINE response path for diagnosis cards.
7. Add tests.

This proves the architecture without moving every template at once.

## Glossary

ResponsePlan:

The response-format orchestration result. It decides intent, formats, quick replies, workflow, and candidate card/template.

RichMessageTemplate:

The canonical reusable template definition.

RichMessageInstance:

The validated and interpolated result for one message.

FlexMessage:

The LINE-specific JSON payload generated by the LINE adapter.

WebRichMessageViewModel:

The web-specific shape consumed by React chat components.

Fallback text:

Plain text generated from the rich message instance for copy, logs, old clients, and unsupported channels.
