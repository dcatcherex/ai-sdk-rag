# Response Format Orchestration Implementation Guide

> Audience: AI coders, backend developers, frontend developers, product owners, and skill authors building production Vaja experiences.
> Purpose: define a profession-neutral response format layer for Vaja's LINE-first, skill-first AI cowork platform.

## Status

Current state:

- LINE text replies are implemented.
- Markdown stripping for LINE text is implemented.
- Quick replies are partially implemented.
- Generic Flex rendering exists for bullet-heavy replies.
- LINE Flex template management exists.
- Agriculture-specific AgriSpark Flex templates exist as seeded templates.
- Several skills already define structured response contracts through headings.

Production gap:

- The runtime does not yet have a single deterministic response-format orchestration layer.
- Skill response contracts are prompt-level conventions, not typed runtime contracts.
- The system can render Flex cards, but does not yet reliably select a domain-specific template for every structured use case.
- Escalation and follow-up actions are not yet represented as first-class response intents across all professions.

This document defines the production target.

Read this together with:

- `docs/vaja-vision.md`
- `docs/line-oa-dev-guide.md`
- `docs/contest/flex-message-feature-plan.md`
- `docs/domain-neutral-profile-entity-layer-implementation.md`
- `docs/privacy-governance-implementation.md`
- `docs/agent-run-service-implementation.md`

## Core Principle

Vaja should choose the simplest response format that helps the user act.

Do not force visual cards for every answer. Do not leave complex decisions as unstructured text.

The same architecture should work for:

- farmer diagnosis and weather risk
- classroom lesson or student support
- clinic follow-up and patient communication
- creator content planning
- sales pipeline coaching
- government service guidance
- SME operations and customer service

## Format Ladder

Use a five-level response ladder.

| Level | Format | Use when |
| --- | --- | --- |
| 1 | Plain text | Short answers, simple Q&A, conversational replies |
| 2 | Structured text | The answer needs fixed headings, safety steps, or decision framing |
| 3 | Quick replies | The user has obvious next actions, confirmations, or follow-up choices |
| 4 | Card / template | The answer is a record, alert, diagnosis, summary, checklist, quote, or status |
| 5 | Workflow / escalation | Human review, approval, booking, handoff, or high-risk case handling is needed |

The runtime should be able to combine levels.

Examples:

- Plain text + quick replies.
- Structured text + quick replies.
- Flex card + plain text fallback.
- Escalation workflow + summary card + officer/admin notification.

## Current Implementation Reference

Relevant files:

- `features/line-oa/webhook/flex/reply.ts`
- `features/line-oa/webhook/flex/welcome.ts`
- `features/line-oa/webhook/utils/markdown.ts`
- `features/line-oa/webhook/utils/quick-reply.ts`
- `features/line-oa/flex/seeds/agrispark-templates.ts`
- `db/schema/line-oa.ts`
- `app/api/line-oa/flex-templates/route.ts`
- `app/api/line-oa/flex-drafts/route.ts`
- `features/skills/packages/**/SKILL.md`

Current useful behavior:

- `stripMarkdown()` cleans model output for LINE.
- `buildReplyMessages()` switches to a generic Flex bubble for bullet-heavy replies.
- `buildQuickReplyItem()` creates simple message quick replies.
- `lineFlexTemplate` and `lineFlexDraft` support managed and user-created Flex payloads.
- Skills can define required headings and response contracts.

Production direction:

- Keep the current generic behavior as fallback.
- Add typed response intents and format routing before final LINE rendering.
- Let skills declare response contracts, but keep channel rendering in platform code.

## Proposed Module

Add:

```txt
features/response-format/
  types.ts
  schema.ts
  service.ts
  registry.ts
  renderer.ts
  contracts.ts
  safety.ts
  channels/
    line.ts
    web.ts
  templates/
    common.ts
    agriculture.ts
    education.ts
    clinic.ts
    sales.ts
    creator.ts
  server/
    parse.ts
    select.ts
    audit.ts
  tests/
```

Do not put response-format logic directly in `features/line-oa/webhook/events/message.ts`.

The LINE webhook should call a shared renderer:

```ts
const responsePlan = await buildResponsePlan({
  text,
  activeSkills,
  toolResults,
  channel: "line",
  locale,
  context,
});

const lineMessages = renderResponseForLine(responsePlan);
```

## Response Plan Type

Add a typed intermediate representation.

```ts
export type ResponseFormat =
  | "plain_text"
  | "structured_text"
  | "quick_replies"
  | "card"
  | "workflow";

export type ResponseIntent =
  | "answer"
  | "advisory"
  | "diagnosis"
  | "risk_summary"
  | "record_confirmation"
  | "record_saved"
  | "market_guidance"
  | "lesson_plan"
  | "student_support"
  | "patient_follow_up"
  | "client_follow_up"
  | "content_plan"
  | "approval_request"
  | "escalation"
  | "broadcast"
  | "unknown";

export type ResponsePlan = {
  intent: ResponseIntent;
  formats: ResponseFormat[];
  locale: string;
  title?: string;
  summary?: string;
  bodyText: string;
  sections?: ResponseSection[];
  quickReplies?: ResponseQuickReply[];
  card?: ResponseCard;
  workflow?: ResponseWorkflow;
  safety?: ResponseSafety;
  metadata?: Record<string, unknown>;
};
```

Core section shape:

```ts
export type ResponseSection = {
  key: string;
  label: string;
  value: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
};
```

Quick reply shape:

```ts
export type ResponseQuickReply = {
  label: string;
  text?: string;
  postbackData?: string;
  actionType: "message" | "postback" | "camera" | "camera_roll" | "location" | "datetime";
};
```

Card shape:

```ts
export type ResponseCard = {
  templateKey: string;
  altText: string;
  data: Record<string, unknown>;
  fallbackText: string;
};
```

Workflow shape:

```ts
export type ResponseWorkflow = {
  type: "human_review" | "approval" | "handoff" | "booking" | "data_capture";
  priority: "normal" | "urgent";
  reason: string;
  assigneeRole?: string;
  data?: Record<string, unknown>;
};
```

## Skill Response Contracts

Skills should continue to use plain `SKILL.md`, but add optional response contract hints in frontmatter or a standard section.

Preferred frontmatter extension:

```yaml
response-contracts:
  - intent: diagnosis
    default-format: structured_text
    card-template: agriculture.diagnosis
    escalation: supported
  - intent: record_confirmation
    default-format: card
    card-template: agriculture.record_entry
```

If frontmatter parsing is not extended yet, use a standard markdown section:

```md
## Response Contracts

- intent: diagnosis
- default-format: structured_text
- card-template: agriculture.diagnosis
- required sections: likely_issue, confidence, severity, immediate_action, prevention, escalation
```

Rules:

- Skills define what the response must contain.
- Platform renderers decide how that content appears in LINE, web, email, export, or future channels.
- Do not let every skill invent its own channel-specific rendering code.

## Format Selection Rules

Add:

```txt
features/response-format/server/select.ts
```

Selection priority:

1. Safety or escalation requirement.
2. Explicit tool result type.
3. Skill response contract.
4. Channel capability.
5. User preference and device constraints.
6. Fallback to plain text.

Examples:

| Situation | Format |
| --- | --- |
| One-sentence answer | `plain_text` |
| Advisory with fixed headings | `structured_text` |
| Save/update confirmation | `structured_text + quick_replies` or `card + quick_replies` |
| Record saved | `card` when available, otherwise structured text |
| High-risk diagnosis | `structured_text + escalation workflow` |
| Forecast summary | `card` or `structured_text` |
| Monthly report | `card` or document/export workflow |
| Approval request | `workflow + quick_replies` |

## Channel Rendering

### LINE

Add:

```txt
features/response-format/channels/line.ts
```

LINE renderer responsibilities:

- Strip markdown.
- Split long text under LINE limits.
- Attach quick replies only to the final text/card message.
- Render card templates as Flex messages.
- Provide meaningful `altText`.
- Fallback to structured text when Flex rendering fails.
- Respect LINE feature limits, including quick reply label length and max quick reply count.

LINE format mapping:

| Response plan | LINE output |
| --- | --- |
| `plain_text` | text message |
| `structured_text` | text message with labels/headings |
| `quick_replies` | LINE quick reply actions |
| `card` | Flex message with fallback text |
| `workflow` | text/card plus postback or notification |

### Web

Add:

```txt
features/response-format/channels/web.ts
```

Web renderer responsibilities:

- Preserve markdown where useful.
- Render cards as React components.
- Show workflow status and audit data.
- Support richer tables, expandable context, and source panels.
- Allow admin/officer review states where permitted.

## Template Registry

Add a platform registry for card templates.

```ts
export type ResponseTemplate = {
  key: string;
  title: string;
  supportedChannels: Array<"line" | "web">;
  intent: ResponseIntent;
  requiredDataKeys: string[];
  renderLine?: (data: Record<string, unknown>) => LineMessage;
  renderWeb?: (data: Record<string, unknown>) => ReactNode;
};
```

Template keys should be domain-aware but not platform-core hardcoded in the database schema.

Examples:

- `common.confirmation`
- `common.escalation`
- `common.approval_request`
- `agriculture.diagnosis`
- `agriculture.weather_risk`
- `agriculture.record_entry`
- `education.lesson_plan`
- `education.student_support`
- `clinic.follow_up`
- `sales.deal_update`
- `creator.content_plan`
- `government.service_steps`

Templates can be backed by:

- code renderers for production-critical cards
- `lineFlexTemplate` records for admin-managed LINE templates
- user `lineFlexDraft` records for custom channel-specific messages

## Structured Parsing

Current skill outputs often use headings. Production should parse them into `ResponseSection[]`.

Add:

```txt
features/response-format/server/parse.ts
```

Parser responsibilities:

- Parse known heading contracts.
- Parse bullet lists.
- Detect severity/confidence labels.
- Preserve original text as fallback.
- Return partial sections when parsing is imperfect.

Do not make parsing fragile. If parsing fails, send text.

Long-term target:

- For high-value workflows, use structured model output or tool results instead of parsing free text.
- Keep free-text parsing as fallback for imported/community skills.

## Tool Result Integration

Tools should return structured data when possible.

Examples:

Record keeper result:

```ts
{
  kind: "record_saved",
  recordId: "...",
  contextType: "agriculture",
  date: "2026-05-01",
  activity: "Applied urea",
  quantity: "50 kg",
  metadata: { profileId, entityIds }
}
```

Weather result:

```ts
{
  kind: "weather_forecast",
  location: "Chiang Mai",
  rangeDays: 7,
  daily: [...]
}
```

The response-format service should use tool result `kind` to select templates without guessing from prose.

## Quick Replies

Quick replies should be generated from response intent and channel capabilities.

Common quick replies:

- `Save this`
- `Edit details`
- `Show summary`
- `Ask human`
- `Add profile`
- `Add entity`
- `Send photo`
- `Share location`
- `Pick date`
- `Create follow-up`

Profession examples:

- Agriculture: `Save record`, `Ask officer`, `Add plot`, `Send another photo`.
- Education: `Create lesson`, `Add student note`, `Make quiz`.
- Clinic: `Create follow-up`, `Add visit note`, `Escalate to clinician`.
- Sales: `Log follow-up`, `Update deal`, `Draft message`.
- Creator: `Make caption`, `Schedule post`, `Create variations`.

Rules:

- Keep quick replies to the minimum useful set.
- Prefer 2 to 4 options.
- Never show actions the user is not authorized to perform.
- Use postbacks for stateful actions and message actions for simple prompts.

## Escalation Workflows

Escalation should be profession-neutral.

Examples:

- Agriculture: extension officer review.
- Education: school counselor or teacher review.
- Clinic: clinician review.
- Sales: manager approval.
- Government: officer handoff.
- Creator/brand: compliance or brand approval.

Add a workflow type:

```txt
human_review
```

Minimum fields:

- scope
- subject
- reason
- priority
- source thread/message
- assigned role
- status
- audit log

Escalation triggers:

- user explicitly asks for human help
- low confidence
- high severity
- safety risk
- legal/medical/financial risk
- sensitive personal data
- action requires approval

## Safety And Governance

Response format is part of safety.

Rules:

- High-risk answers should use fixed sections, not casual paragraphs.
- Uncertain answers must show uncertainty.
- Human review options should be visible when needed.
- Cards should include meaningful fallback text for accessibility and LINE quote previews.
- External broadcasts should use officer/admin review before sending.
- Do not hide safety disclaimers inside tiny card footers.
- Do not over-card simple answers.

Connect to:

- `docs/privacy-governance-implementation.md`
- `docs/ai-audit-observability-implementation.md`

## API And Service Boundaries

Recommended service flow:

```txt
agent/tool output
  -> response-format service builds ResponsePlan
  -> channel renderer converts plan to LINE/web/etc.
  -> route sends rendered messages
  -> audit records response intent and format
```

Route files should not decide business meaning.

The route can decide channel-specific delivery details, but not domain-specific response shape.

## Database Considerations

Avoid adding a table for every profession's card type.

Use existing:

- `lineFlexTemplate`
- `lineFlexDraft`
- `toolRun`
- `chatRun`
- `chatMessage.metadata`

Potential additions later:

```txt
response_template
response_render_log
response_workflow
```

Only add these once runtime orchestration needs persistence.

## Observability

Track response quality and format performance.

Add audit fields where practical:

- `responseIntent`
- `responseFormats`
- `templateKey`
- `quickReplyCount`
- `escalationCreated`
- `renderFallbackUsed`
- `parseConfidence`

Useful metrics:

- card click or postback rate
- quick reply tap rate
- escalation rate
- fallback-to-text rate
- user correction rate
- officer/admin override rate
- average response length

## Implementation Phases

### Phase 1: Shared Types And Fallback Renderer

- Add `features/response-format/types.ts`.
- Add `ResponsePlan`.
- Add LINE renderer that wraps current `stripMarkdown`, `buildReplyMessages`, and quick reply handling.
- Keep existing behavior as fallback.

### Phase 2: Skill Contract Registry

- Add contract parsing from skill metadata or standard markdown sections.
- Register common intents.
- Add tests for agriculture, education, clinic, sales, and creator examples.

### Phase 3: Tool Result Mapping

- Add tool result `kind` conventions.
- Map record keeper, weather, domain profile, approval, and content tools to intents.
- Prefer tool result structure over prose parsing.

### Phase 4: Card Template Routing

- Add template registry.
- Map existing AgriSpark templates through registry.
- Add common templates for confirmation, escalation, approval, and summary.
- Add web rendering equivalents where needed.

### Phase 5: Workflow And Escalation

- Add generic `human_review` response workflow.
- Connect to privacy/access-control rules.
- Add officer/admin review UI only after scope and audit are ready.

### Phase 6: Production Observability

- Store response intent and format metadata in audit logs.
- Add format metrics to admin analytics.
- Use pilot data to decide where cards improve outcomes and where text is better.

## Testing Checklist

- Short answer renders as plain text.
- Structured advisory renders with headings and readable LINE text.
- Bullet-heavy response still falls back to generic Flex bubble.
- Known card template renders valid LINE Flex JSON.
- Failed card rendering falls back to text.
- Quick reply labels are truncated safely.
- Quick replies do not exceed LINE limits.
- Unauthorized quick reply actions are hidden.
- Escalation response creates or references a workflow.
- Web renderer can show the same response plan without LINE-specific assumptions.
- Skill contract parser tolerates missing or malformed contract sections.
- Tool result mapping does not depend on English-only text.

## AI Coder Guardrails

When implementing response formats:

- Keep channel rendering separate from skill reasoning.
- Do not hardcode agriculture-only formats into the shared runtime.
- Do not make every response a card.
- Do not parse brittle prose when a tool can return structured data.
- Do not put LINE SDK types into generic service layers.
- Do not expose actions the user cannot perform.
- Always provide plain text fallback for Flex/card output.
- Keep Thai text readable in small mobile cards.
- Keep safety and uncertainty visible.
- Use `@/` imports and `pnpm`.

## Production Acceptance Criteria

Before broad production deployment:

- Common response intents are typed.
- LINE and web rendering use the same `ResponsePlan`.
- High-risk workflows have structured sections and escalation support.
- Cards have plain text fallback.
- Quick replies are permission-aware.
- Skill contracts can be reviewed by domain experts.
- Response format choices are audited.
- Template rendering is tested on mobile LINE.

## Suggested Committee Answer

Vaja's planned response format is adaptive. The system uses direct text for simple questions, structured text for advisory flows, quick replies for next actions, visual cards for records, diagnosis, alerts, summaries, and approvals, and human-review workflows for severe or uncertain cases.

This is not agriculture-only. The same response orchestration can support many professions: diagnosis cards for agriculture, lesson-plan cards for teachers, follow-up cards for clinics, deal-update cards for sales teams, content-plan cards for creators, and service-step cards for government workflows.

The design rule is simple: use plain text when that is clearest, use structured headings when the user needs to act safely, use cards when structure improves decision-making, and use escalation workflows when a human should review the case.
