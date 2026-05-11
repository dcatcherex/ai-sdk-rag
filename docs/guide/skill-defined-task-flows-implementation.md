# Skill-Defined Task Flows Implementation Guide

Status: in progress  
Last updated: 2026-05-11  
Audience: AI coders, backend developers, frontend developers, and product engineers  

## Progress Update

Current implementation status in this branch:

- [x] Phase 1: code-backed generic task-flow engine
- [x] Phase 2: web chat follow-up intercept before main LLM call
- [x] Phase 3: continue slot filling across turns using message metadata
- [x] Shared-link chat uses the same `resolveTaskFlow()` path for follow-up + ready-state prompt shaping
- [x] Ready task flows can seed the existing response-format/rich-message path for `agriculture.diagnosis`
- [x] Added a second built-in profession flow: `education.lesson_plan`
- [x] Agriculture diagnosis prompt shaping now defaults to advisory, human-in-the-loop guidance
- [x] Web/shared-link intercept behavior is now routed through a shared task-flow runtime helper with tests
- [x] LINE now uses the shared task-flow runtime for cautious rollout: generic follow-up intercepts plus ready-state `education.lesson_plan` and `agriculture.diagnosis`, while the agriculture intent router remains as fallback for the rest
- [~] Phase 4 is partially complete: task-flow ready decisions now go through a canonical `buildResponsePlanFromTaskFlow()` bridge, but route/runtime usage is still not fully unified end-to-end
- [ ] LINE migration
- [ ] Skill package `task-flows/*.json` import
- [ ] Admin visibility/debugging
- [ ] Durable DB-backed task state

Verification run for the shipped slice:

```bash
pnpm exec tsc --noEmit
pnpm exec tsx --test features\task-flows\service.test.ts
pnpm exec tsx --test features\chat\server\finalization.test.ts
```

## Purpose

Make Vaja helpful for normal users who do not know how to write perfect prompts.

Vaja should understand messy, natural messages like:

```txt
ใบเหลือง มีจุดดำ ช่วยดูหน่อย
```

and guide the user into a useful professional workflow:

```txt
เป็นพืชอะไรครับ? ถ้ามีรูปใบที่เป็นอาการ แนบมาได้เลยครับ
```

then, once enough information exists, produce a reusable structured result:

```txt
Task flow result
  -> response-format plan
  -> rich message card
  -> web chat / shared chat / LINE
```

This document defines a reusable intent detection, slot extraction, and missing-field follow-up system that works across professions. Agriculture is the first example, not the platform model.

## Product Principle

Users should speak naturally. Vaja should do the structuring.

The platform should not expect users to write prompts like:

```txt
Please return a plant diagnosis with crop_name, diagnosis, severity, recommendation.
```

Instead, each profession skill should define how to recognize common work intents, what information is required, how to ask for missing fields, and which tool or rich message template should be used.

## Relationship To Vaja Vision

Vaja is a skill-first, agent-first AI cowork platform.

This system turns skills from passive prompt fragments into active workflow knowledge:

```txt
Skill = profession knowledge
Task Flow = profession workflow
Rich Message = reusable result display
Tool = business action
```

Examples:

- farmer: diagnose plant symptoms, check farm weather risk, record farm activity
- teacher: create lesson plan, generate quiz, summarize student progress
- clinic assistant: collect symptom triage info, prepare follow-up summary
- legal assistant: review contract concern, collect jurisdiction and contract type
- sales assistant: qualify lead, prepare follow-up message, summarize opportunity
- accountant: classify expense, prepare tax document checklist

The platform owns the generic engine. Skills own domain-specific task definitions.

## Non-Goals

- Do not hardcode agriculture-specific slot rules in platform core.
- Do not replace agent skills. This system should extend the skills model.
- Do not force every response into a task flow.
- Do not make every task flow a form. The default interaction is still chat.
- Do not render rich cards until there is enough information to produce a useful result.
- Do not bypass `features/response-format/` or `features/rich-messages/`.

## Existing Code To Reuse

Relevant existing files:

- `features/skills/service.ts`
- `db/schema/skills.ts`
- `app/api/chat/route.ts`
- `app/api/agent/[token]/chat/route.ts`
- `features/chat/server/finalization-helpers.ts`
- `features/response-format/server/select.ts`
- `features/response-format/types.ts`
- `features/rich-messages/service.ts`
- `features/rich-messages/server/runtime.ts`
- `components/message-renderer/message-part-renderer.tsx`
- `features/line-oa/webhook/events/intent-router.ts`
- `features/line-oa/webhook/events/text-replies.ts`

Important existing behavior:

- Web chat and shared-link chat can now emit `data-rich-message` in the live stream.
- Finalization also persists rich-message parts through `buildAssistantResponseArtifacts()`.
- LINE rendering can use canonical rich-message templates and linked LINE Flex overrides.
- LINE has an agriculture-specific intent router. This should become a reference for the generic engine, not the final platform architecture.

## Target Architecture

```txt
User message
  -> active agent + active skills
  -> task-flow registry from skills
  -> deterministic intent detection
  -> optional LLM intent classification
  -> slot extraction
  -> conversation state merge
  -> missing-field policy
  -> follow-up question OR ready task result
  -> tool / response-format / rich-message
```

Core platform modules:

```txt
features/task-flows/
  types.ts
  schema.ts
  registry.ts
  intent-detector.ts
  slot-extractor.ts
  state.ts
  follow-up.ts
  service.ts
  templates/
    agriculture.ts
  server/
    repository.ts
    runtime.ts
  tests/
    service.test.ts
    intent-detector.test.ts
    slot-extractor.test.ts
```

The initial implementation can keep built-in flow definitions in code, then later load flow definitions from `agentSkillFile` / imported skill packages.

## Core Types

Create `features/task-flows/types.ts`.

```ts
export type TaskFlowChannel = "web" | "shared_link" | "line";

export type TaskFlowIntentSource = "rule" | "model" | "state" | "fallback";

export type TaskFlowSlotType =
  | "text"
  | "number"
  | "date"
  | "location"
  | "image"
  | "enum"
  | "boolean";

export type TaskFlowSlotDefinition = {
  key: string;
  label: string;
  type: TaskFlowSlotType;
  required: boolean;
  question: string;
  examples?: string[];
  extractionHints?: string[];
  enumValues?: string[];
};

export type TaskFlowDefinition = {
  key: string;
  skillKey?: string;
  profession: string;
  title: string;
  description: string;
  triggers: string[];
  negativeTriggers?: string[];
  requiredSlots: TaskFlowSlotDefinition[];
  optionalSlots?: TaskFlowSlotDefinition[];
  outputTemplateKey?: string;
  toolName?: string;
  safetyLevel?: "normal" | "caution" | "high_stakes";
  channels?: TaskFlowChannel[];
};

export type TaskFlowSlotValue = {
  key: string;
  value: unknown;
  confidence: number;
  source: "user_message" | "conversation_state" | "model" | "tool";
};

export type TaskFlowDecision =
  | {
      status: "no_match";
      confidence: number;
      source: TaskFlowIntentSource;
    }
  | {
      status: "needs_more_info";
      flowKey: string;
      confidence: number;
      source: TaskFlowIntentSource;
      slots: Record<string, unknown>;
      missingSlots: string[];
      followUpQuestion: string;
    }
  | {
      status: "ready";
      flowKey: string;
      confidence: number;
      source: TaskFlowIntentSource;
      slots: Record<string, unknown>;
      outputTemplateKey?: string;
      toolName?: string;
    };
```

## Example Flow Definitions

Create `features/task-flows/templates/agriculture.ts`.

```ts
export const agricultureDiagnosisFlow = {
  key: "agriculture.diagnosis",
  profession: "agriculture",
  title: "Plant diagnosis",
  description: "Diagnose likely crop disease, pest, or stress from symptoms.",
  triggers: [
    "ใบเหลือง",
    "จุดดำ",
    "ใบหงิก",
    "พืชเป็นอะไร",
    "ช่วยดูอาการ",
    "วิเคราะห์โรคพืช",
    "diagnose plant",
    "plant disease",
  ],
  requiredSlots: [
    {
      key: "crop_name",
      label: "Crop",
      type: "text",
      required: true,
      question: "เป็นพืชอะไรครับ? ถ้ามีรูปใบที่เป็นอาการ แนบมาได้เลยครับ",
      examples: ["มะเขือเทศ", "ข้าว", "พริก"],
    },
    {
      key: "symptoms",
      label: "Symptoms",
      type: "text",
      required: true,
      question: "อาการหลักคืออะไรครับ เช่น ใบเหลือง จุดดำ เหี่ยว หรือรากเน่า?",
    },
  ],
  optionalSlots: [
    {
      key: "duration",
      label: "Duration",
      type: "text",
      required: false,
      question: "เริ่มเป็นมานานแค่ไหนครับ?",
    },
    {
      key: "weather_context",
      label: "Weather context",
      type: "text",
      required: false,
      question: "ช่วงนี้ฝนตกหรือความชื้นสูงไหมครับ?",
    },
  ],
  outputTemplateKey: "agriculture.diagnosis",
  safetyLevel: "caution",
  channels: ["web", "shared_link", "line"],
} satisfies TaskFlowDefinition;
```

Other profession examples:

```ts
export const teacherLessonPlanFlow = {
  key: "education.lesson_plan",
  profession: "education",
  title: "Lesson plan",
  triggers: ["แผนการสอน", "lesson plan", "เตรียมสอน"],
  requiredSlots: [
    { key: "grade_level", label: "Grade", type: "text", required: true, question: "สอนระดับชั้นไหนครับ?" },
    { key: "subject", label: "Subject", type: "text", required: true, question: "วิชาและหัวข้อคืออะไรครับ?" },
    { key: "duration", label: "Duration", type: "text", required: true, question: "คาบนี้ใช้เวลากี่นาทีครับ?" },
  ],
  outputTemplateKey: "education.lesson_plan",
} satisfies TaskFlowDefinition;
```

```ts
export const salesLeadQualificationFlow = {
  key: "sales.lead_qualification",
  profession: "sales",
  title: "Lead qualification",
  triggers: ["ลูกค้าใหม่", "qualify lead", "สนใจซื้อ", "ติดตามลูกค้า"],
  requiredSlots: [
    { key: "customer_need", label: "Need", type: "text", required: true, question: "ลูกค้าสนใจเรื่องอะไรเป็นหลักครับ?" },
    { key: "budget_or_size", label: "Budget or size", type: "text", required: true, question: "มีงบประมาณหรือขนาดงานคร่าว ๆ ไหมครับ?" },
  ],
  outputTemplateKey: "sales.lead_summary",
} satisfies TaskFlowDefinition;
```

## Skill Package Extension

Long term, imported skills should be able to include task-flow definitions.

Recommended package shape:

```txt
my-profession-skill/
  SKILL.md
  task-flows/
    diagnosis.json
    lesson-plan.json
  references/
  assets/
```

`task-flows/*.json` should validate against a Zod schema in `features/task-flows/schema.ts`.

Example JSON:

```json
{
  "key": "agriculture.diagnosis",
  "profession": "agriculture",
  "title": "Plant diagnosis",
  "description": "Diagnose likely crop disease, pest, or stress from symptoms.",
  "triggers": ["ใบเหลือง", "จุดดำ", "พืชเป็นอะไร"],
  "requiredSlots": [
    {
      "key": "crop_name",
      "label": "Crop",
      "type": "text",
      "required": true,
      "question": "เป็นพืชอะไรครับ?"
    },
    {
      "key": "symptoms",
      "label": "Symptoms",
      "type": "text",
      "required": true,
      "question": "อาการหลักคืออะไรครับ?"
    }
  ],
  "outputTemplateKey": "agriculture.diagnosis"
}
```

Implementation note:

- Phase 1 can use code-backed definitions only.
- Phase 2 can read `task-flows/*.json` from imported skill files.
- Phase 3 can add admin authoring.

## Detection Strategy

Use a hybrid detector.

1. Deterministic matching:
   - trigger keyword match
   - regex match
   - active conversation state
   - quick reply/postback intent

2. Model classification:
   - only when deterministic confidence is low or multiple flows match
   - return strict JSON
   - cap candidate flows to active skills plus a small built-in set

3. Confidence thresholds:
   - `>= 0.75`: accept
   - `0.45 - 0.74`: ask a clarifying question if a likely workflow exists
   - `< 0.45`: fall back to normal chat

Do not run expensive classification for every message if a simple rule is enough.

## Slot Extraction Strategy

Slot extraction should be conservative.

Inputs:

- current user message
- last 4-6 messages
- existing task-flow state
- active skill definitions
- attached image metadata, if present

Outputs:

```ts
{
  slots: {
    crop_name: "มะเขือเทศ",
    symptoms: "ใบเหลือง มีจุดดำ"
  },
  slotConfidence: {
    crop_name: 0.86,
    symptoms: 0.9
  }
}
```

Rules:

- Never invent required slot values.
- It is okay to infer simple symptoms from text.
- For high-stakes flows, ask one more question when confidence is low.
- If an image exists, mark `photo = true`, but do not claim visual diagnosis unless the model actually analyzed the image.

## Missing-Field Follow-Up Policy

Ask the smallest useful next question.

Bad:

```txt
กรุณาระบุชื่อพืช อายุพืช ระยะเวลา สภาพอากาศ ประวัติการให้ปุ๋ย และรูปภาพ
```

Good:

```txt
เป็นพืชอะไรครับ? ถ้ามีรูปใบที่เป็นอาการ แนบมาได้เลยครับ
```

Rules:

- Ask at most two missing fields in one turn.
- Prefer the highest-value required missing slot.
- Include examples when useful.
- Use the user's locale.
- Do not ask follow-up questions after enough required slots exist.
- For `safetyLevel = "high_stakes"`, ask for more context before giving decisive advice.

## Conversation State

Task flows need short-lived state across turns.

Initial approach:

- store state in assistant/user message metadata
- hydrate from recent messages
- no DB migration needed

Message metadata shape:

```ts
type TaskFlowMessageMetadata = {
  taskFlow?: {
    flowKey: string;
    status: "needs_more_info" | "ready" | "completed";
    slots: Record<string, unknown>;
    missingSlots: string[];
    updatedAt: string;
  };
};
```

Later approach:

- add `chatThreadTaskState` table if we need durable multi-day workflows
- useful for long-running case management, CRM workflows, healthcare intake, and legal review

Possible schema:

```ts
chatThreadTaskState
  id
  threadId
  channel
  flowKey
  status
  slots jsonb
  missingSlots jsonb
  expiresAt
  createdAt
  updatedAt
```

## Service API

Create `features/task-flows/service.ts`.

```ts
export async function resolveTaskFlow(input: {
  channel: TaskFlowChannel;
  message: string;
  messages: ChatMessage[];
  activeSkillIds: string[];
  activeSkillNames: string[];
  locale?: string;
}): Promise<TaskFlowDecision> {
  // 1. load candidate definitions
  // 2. detect intent
  // 3. extract slots
  // 4. merge conversation state
  // 5. return no_match, needs_more_info, or ready
}
```

Add helper:

```ts
export function buildTaskFlowFollowUpMessage(decision: Extract<TaskFlowDecision, { status: "needs_more_info" }>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: decision.followUpQuestion }],
    metadata: {
      taskFlow: {
        flowKey: decision.flowKey,
        status: "needs_more_info",
        slots: decision.slots,
        missingSlots: decision.missingSlots,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
```

## Runtime Integration

### Web Chat

Integrate before `streamText()` in `app/api/chat/route.ts`.

Recommended behavior:

```txt
incoming message
  -> resolveTaskFlow()
  -> if needs_more_info: stream a short assistant follow-up and persist
  -> if ready: inject task-flow context into model or call tool
  -> normal streamText path
```

For the first slice, use this simple behavior:

- if `needs_more_info`, return a one-message UI stream with the follow-up question
- persist it through `finalizeTextChatTurn()`
- do not call the LLM

This reduces cost and makes the product feel crisp.

### Shared-Link Chat

Use the same `resolveTaskFlow()` path in `app/api/agent/[token]/chat/route.ts`.

The shared-link path should:

- use active agent skill context where available
- persist follow-up state to the guest thread
- support `data-rich-message` when the task is ready

### LINE

Replace the agriculture-specific router gradually.

Current:

```txt
features/line-oa/webhook/events/intent-router.ts
```

Target:

```txt
LINE text message
  -> resolveTaskFlow({ channel: "line" })
  -> needs_more_info: reply with text/quick replies
  -> ready: use response-format + rich-message + LINE override
```

Keep the current LINE agriculture router until generic task flows are proven in web/shared chat.

## Response-Format Integration

Task flow should not render cards itself.

When a task flow is ready, it can produce:

```ts
{
  status: "ready",
  flowKey: "agriculture.diagnosis",
  outputTemplateKey: "agriculture.diagnosis",
  slots: {
    crop_name: "มะเขือเทศ",
    symptoms: "ใบเหลือง มีจุดดำ"
  }
}
```

Then response-format decides how to turn the available data into:

- a rich message
- text fallback
- quick replies
- tool action

For the first implementation, add a bridge:

```ts
buildResponsePlanFromTaskFlow(decision)
```

Later, merge this into `features/response-format/server/select.ts`.

## Skill Safety And Governance

Some professions need stronger safety behavior.

Recommended safety levels:

- `normal`: education, sales, content, general operations
- `caution`: agriculture, HR, finance operations
- `high_stakes`: medical, legal, tax, financial advice

For `high_stakes`:

- ask clarifying questions before giving conclusions
- include uncertainty in final output
- avoid definitive diagnosis/legal/tax claims
- prefer "summary for professional review" templates
- never skip disclaimers when required by the skill

## Implementation Phases

### Phase 0: Alignment And Boundaries

Goal: confirm module boundaries and reuse points.

Checklist:

- Read this document.
- Read `docs/rich-message-template-system-implementation.md`.
- Confirm `features/rich-messages/` remains the canonical display layer.
- Confirm `features/response-format/` remains the response planning layer.
- Confirm `features/task-flows/` owns intent/slots/follow-up only.
- Do not put profession-specific logic directly in `app/api/chat/route.ts`.

Checkpoint:

- Developers can explain the difference between skill, task flow, response format, rich message, and tool.

### Phase 1: Code-Backed Generic Task Flow Engine

Goal: create the generic task-flow service with one agriculture diagnosis flow.

Files:

- `features/task-flows/types.ts`
- `features/task-flows/schema.ts`
- `features/task-flows/registry.ts`
- `features/task-flows/intent-detector.ts`
- `features/task-flows/slot-extractor.ts`
- `features/task-flows/follow-up.ts`
- `features/task-flows/service.ts`
- `features/task-flows/templates/agriculture.ts`
- `features/task-flows/service.test.ts`

Requirements:

- deterministic trigger matching works for Thai and English
- slot extraction handles simple crop/symptom messages
- missing-field follow-up asks one useful question
- no DB migration
- no client import of server-only code

Checkpoint examples:

```txt
Input: "ใบเหลือง มีจุดดำ ช่วยดูหน่อย"
Output: needs_more_info, missing crop_name
```

```txt
Input: "มะเขือเทศ ใบเหลือง มีจุดดำ"
Output: ready, agriculture.diagnosis
```

Verification:

```bash
pnpm exec tsc --noEmit
pnpm exec tsx --test features\task-flows\service.test.ts
```

### Phase 2: Web Chat Follow-Up Intercept

Goal: normal web chat asks missing-field questions before calling the LLM.

Files:

- `app/api/chat/route.ts`
- `features/chat/server/finalization.ts`
- `features/chat/server/finalization-helpers.ts`
- `features/task-flows/server/web-runtime.ts`

Behavior:

- run `resolveTaskFlow()` before text `streamText()`
- if `needs_more_info`, stream the follow-up question as assistant text
- persist through `finalizeTextChatTurn()`
- attach task-flow metadata to the assistant message
- continue normal LLM path for `no_match`

Checkpoint:

- User sends `ใบเหลือง มีจุดดำ ช่วยดูหน่อย`.
- Assistant immediately asks `เป็นพืชอะไรครับ?...`
- No expensive main LLM response is generated for that turn.

Verification:

```bash
pnpm exec tsc --noEmit
pnpm exec tsx --test features\task-flows\service.test.ts features\chat\server\finalization.test.ts
```

### Phase 3: Continue Slot Filling Across Turns

Goal: if the user answers the follow-up, the system remembers the previous slots.

Files:

- `features/task-flows/state.ts`
- `features/task-flows/service.ts`
- `features/chat/types.ts`

Behavior:

```txt
User: ใบเหลือง มีจุดดำ ช่วยดูหน่อย
Vaja: เป็นพืชอะไรครับ?
User: มะเขือเทศ
Vaja: diagnosis result
```

Requirements:

- read task-flow metadata from recent messages
- merge new user response with previous slots
- mark task flow `ready` when required slots are filled
- avoid repeating the same follow-up question

Checkpoint:

- Multi-turn slot filling works in normal web chat.

### Phase 4: Ready Flow To Rich Message

Goal: when enough slots exist, produce a canonical rich message.

Files:

- `features/task-flows/response-format.ts`
- `features/response-format/server/select.ts`
- `features/chat/server/finalization-helpers.ts`

Behavior:

- ready task flow becomes a response-format card candidate
- rich card is emitted live as `data-rich-message`
- finalization persists the same card
- fallback text remains useful

Important:

- The task-flow engine should not directly render the rich message.
- It should return `outputTemplateKey` and structured slots/data.

Checkpoint:

- Normal web chat shows an agriculture diagnosis rich card after required slots exist.

### Phase 5: Shared-Link Chat

Goal: shared public agent chat supports the same task-flow behavior.

Files:

- `app/api/agent/[token]/chat/route.ts`
- `app/agent/[token]/chat/page.tsx`
- `features/task-flows/server/shared-link-runtime.ts`

Requirements:

- same `resolveTaskFlow()` service
- same missing-field follow-up behavior
- same rich-message live-stream output
- guest thread persistence works

Checkpoint:

- A shared agent link can guide a normal user through a diagnosis flow without prompt engineering.

### Phase 6: LINE Integration

Goal: migrate LINE agriculture intent routing onto generic task flows.

Files:

- `features/line-oa/webhook/events/text-replies.ts`
- `features/line-oa/webhook/events/intent-router.ts`
- `features/task-flows/server/line-runtime.ts`

Approach:

- keep the existing agriculture router as fallback
- add generic `resolveTaskFlow({ channel: "line" })`
- compare decisions in logs during rollout
- then switch known flows to generic task-flow decisions

Checkpoint:

- LINE diagnosis flow uses the same task-flow definition as web/shared chat.
- LINE still uses linked Flex override for final rendering.

### Phase 7: Skill Package Task Flow Import

Goal: skills can define their own workflows without platform code changes.

Files:

- `features/skills/server/package-import.ts`
- `features/task-flows/schema.ts`
- `features/task-flows/registry.ts`
- `db/schema/skills.ts`

Behavior:

- imported skill packages can include `task-flows/*.json`
- files are validated and stored as `agentSkillFile`
- active skill attachments expose task-flow definitions to the runtime registry

Checkpoint:

- A new profession skill can add a new task flow by package import, without editing platform core.

### Phase 8: Admin Visibility And Debugging

Goal: admins can inspect task flows and debug why Vaja asked a follow-up.

Files:

- `app/admin/task-flows/page.tsx`
- `app/api/admin/task-flows/route.ts`
- `features/task-flows/catalog.ts`

Admin page should show:

- flow key
- profession
- source skill
- triggers
- required slots
- output template key
- sample input tester
- decision result JSON

Checkpoint:

- Admin can paste `ใบเหลือง มีจุดดำ` and see `needs_more_info`.
- Admin can paste `มะเขือเทศ ใบเหลือง มีจุดดำ` and see `ready`.

### Phase 9: Durable Task State

Goal: support longer workflows that span time, channels, and sessions.

Add only when needed:

- `db/schema/task-flows.ts`
- `chatThreadTaskState` table
- migrations
- repository/service layer

Use cases:

- sales pipeline follow-up
- clinic intake
- legal document review
- multi-step government form preparation

Checkpoint:

- A task flow can resume after page reload, LINE return visit, or shared-link continuation.

## First Implementation Slice

The first practical slice should be:

1. [x] Build `features/task-flows/` with code-backed definitions.
2. [x] Add `agriculture.diagnosis`.
3. [x] Intercept vague diagnosis prompts in normal web chat.
4. [x] Ask one missing-field follow-up.
5. [x] Continue slot filling on the next user message.
6. [x] Emit the existing `agriculture.diagnosis` rich card when ready.

Do not start with database-backed authoring. Prove the runtime interaction first.

## Acceptance Criteria

A normal user can type:

```txt
ใบเหลือง มีจุดดำ ช่วยดูหน่อย
```

Vaja asks:

```txt
เป็นพืชอะไรครับ? ถ้ามีรูปใบที่เป็นอาการ แนบมาได้เลยครับ
```

Then the user types:

```txt
มะเขือเทศ
```

Vaja returns:

- useful diagnosis text
- `data-rich-message` card in normal web chat
- same behavior in shared-link chat by Phase 5
- same canonical template path for LINE by Phase 6

## Testing Strategy

Unit tests:

- trigger matching
- slot extraction
- missing-field selection
- state merge
- ready/no-match decisions

Integration tests:

- web chat follow-up intercept
- shared-link chat follow-up intercept
- response-format bridge
- rich-message output

Regression tests:

- non-task messages still go to normal chat
- unrelated agriculture messages do not force diagnosis flow
- high-stakes flows do not produce overconfident output
- user can cancel or change topic

Example commands:

```bash
pnpm exec tsc --noEmit
pnpm exec tsx --test features\task-flows\service.test.ts
pnpm exec tsx --test features\chat\server\finalization.test.ts
pnpm exec tsx --test features\response-format\service.test.ts
```

## Rollout Notes

Start with low-risk workflows:

- agriculture diagnosis
- agriculture weather risk
- education lesson plan
- sales lead summary

Be more cautious with:

- medical
- legal
- tax
- regulated finance

For high-stakes skills, default to:

- collect context
- summarize for review
- provide cautious next steps
- recommend professional confirmation where appropriate

## Developer Checklist

Before opening a PR:

- task-flow code is domain-neutral except definitions
- agriculture-specific logic lives in a flow definition, not route code
- web/shared/LINE use the same task-flow service
- rich cards still go through `features/response-format/` and `features/rich-messages/`
- no client component imports server-only services
- tests cover both Thai and English trigger examples
- vague prompt produces follow-up, not generic prose
- complete prompt produces a ready decision

## Future Enhancements

- visual task-flow builder in admin
- analytics for `needs_more_info` vs `ready`
- conversion rate from follow-up to completed rich card
- per-skill task-flow versioning
- A/B testing follow-up question wording
- multilingual follow-up localization
- voice-first slot filling for LINE and mobile
- image-aware slot extraction for professions where photos matter
