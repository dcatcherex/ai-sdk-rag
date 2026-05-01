# Agent-First Chat Empty State Implementation Guide

## Purpose

This document defines the recommended implementation for Vaja AI's first-chat empty state: a job-oriented, agent-aware starting screen that helps users understand what the selected agent can do and begin with a real work task.

The desired direction is a hybrid of the current minimal empty state and the proposed task-card design:

- Keep the chat experience calm, spacious, and Thai-first.
- Make the selected agent's job obvious before the user types.
- Show practical task starters that map to the agent's real capabilities.
- Let users keep control by filling the composer with a draft prompt before sending.
- Keep the implementation data-driven and easy to maintain across many agents.

This should feel like opening a coworker's workspace, not a generic prompt playground.

## Implementation Progress Tracker

Last updated: 2026-04-30

Status legend:

- `[x]` Done
- `[~]` In progress / needs visual review
- `[ ]` Not started

### Phase Summary

| Phase | Status | Goal | Notes |
|---|---:|---|---|
| Phase 0 - Design spec | `[x]` | Define UX direction, data model, maintainability rules, and acceptance criteria. | Captured in this document. |
| Phase 1 - Component foundation | `[x]` | Create reusable empty-state components and starter-task types. | Implemented under `features/chat/components/empty-state/`. |
| Phase 2 - Starter task presets | `[x]` | Add job-oriented starter tasks for Marketing, LINE OA, Research, and general fallback. | Implemented in `task-starter-data.ts`. |
| Phase 3 - Chat empty-state replacement | `[x]` | Replace inline empty-state JSX with `AgentChatEmptyState`. | Implemented in `features/chat/components/message-list/chat-message-list.tsx`. |
| Phase 4 - Composer draft-fill behavior | `[x]` | Clicking a task fills the composer and focuses it without auto-sending. | Implemented through page state and `PreparedPromptBridge` in the composer. |
| Phase 5 - Verification | `[x]` | Run type-check and production build. | `pnpm exec tsc --noEmit` passed. `pnpm build` passed. |
| Phase 6 - Visual QA | `[x]` | Review in browser on desktop/mobile, dark mode, and real agent data. | Desktop/mobile light-dark pass done, click-to-fill verified, mobile spacing tightened, and guest fallback labeling aligned with the generic Vaja state. |
| Phase 7 - Agent coverage expansion | `[x]` | Add richer presets for the remaining Essentials agents. | All Essentials agents now have dedicated presets, and matcher tests verify the seeded official names/descriptions resolve to the intended preset set. |
| Phase 8 - Admin-managed structured tasks | `[x]` | Let admins define structured starter tasks instead of relying only on local presets. | Added persisted `starterTasks` on agents, admin-editor controls, API support, and empty-state precedence for stored structured tasks. |

### Completed Implementation

- `[x]` Added `AgentStarterTask` and icon types in `features/chat/components/empty-state/types.ts`.
- `[x]` Added task preset and normalization logic in `features/chat/components/empty-state/task-starter-data.ts`.
- `[x]` Added primary card UI in `features/chat/components/empty-state/agent-task-card.tsx`.
- `[x]` Added compact secondary row UI in `features/chat/components/empty-state/agent-task-row.tsx`.
- `[x]` Added layout composition in `features/chat/components/empty-state/agent-chat-empty-state.tsx`.
- `[x]` Replaced old empty-state rendering in `features/chat/components/message-list/chat-message-list.tsx`.
- `[x]` Extended message-list props in `features/chat/components/message-list/types.ts`.
- `[x]` Added page-level prepared prompt state in `app/page.tsx`.
- `[x]` Added composer bridge behavior in `features/chat/components/composer/chat-composer.tsx`.
- `[x]` Preserved existing follow-up suggestion behavior after a conversation has started.
- `[x]` Added richer starter-task presets for General Assistant, Customer Support Bot, Sales & Admin, Writing Assistant, Teacher Assistant, and Farm Advisor.
- `[x]` Updated preset selection priority so known agent presets win before raw `starterPrompts`, matching this guide.
- `[x]` Added exact-name preset matching so official seeded agent names resolve before broader keyword heuristics.
- `[x]` Added matcher regression tests for all Essentials agent presets in `features/chat/components/empty-state/task-starter-data.test.ts`.
- `[x]` Added persisted structured starter tasks on agents via `starterTasks` JSONB.
- `[x]` Added admin-editor controls for structured starter tasks in the General section.
- `[x]` Updated chat empty-state resolution to prefer stored structured tasks before presets and raw prompt chips.

### Remaining To-Do

- `[x]` Visual QA on desktop: baseline density, spacing, and composer visibility reviewed in local screenshots.
- `[x]` Visual QA on mobile: spacing tightened and empty-state/composer overlap reduced in local screenshots.
- `[x]` Dark-mode QA: baseline contrast, icon accents, borders, and focus rings reviewed in local screenshots.
- `[x]` Review real official agent names and descriptions to make sure preset matching catches the intended agents.
- `[x]` Add starter task presets for General Assistant, Customer Support Bot, Sales & Admin, Writing Assistant, Teacher Assistant, and Farm Advisor.
- `[x]` Verify each Essentials agent hits the intended preset against real seeded metadata.
- `[ ]` Replace any mojibake Thai copy still present in older chat constants when touching those areas.
- `[ ]` Add lightweight interaction tests if this becomes a regression-prone surface.
- `[x]` Decide whether admin-managed agents need structured `starterTasks` in the editor after the first release is reviewed.

### Validation Log

```bash
pnpm exec tsc --noEmit
# Passed on 2026-04-30

pnpm build
# Passed on 2026-04-30

pnpm exec tsx --test features/chat/components/empty-state/task-starter-data.test.ts
# Passed on 2026-04-30

pnpm test
# Passed on 2026-04-30

pnpm exec tsc --noEmit
# Passed again after Phase 8 implementation on 2026-04-30
```

Additional Phase 6 checks:

```bash
# Local Playwright screenshot pass against http://localhost:3000
# Verified desktop light/dark and mobile light/dark renders on 2026-04-30

# Local interaction check
# Clicking an empty-state task filled the composer without navigation or auto-send on 2026-04-30

# Guest fallback alignment check
# Composer fallback label now matches the generic Vaja empty state on 2026-04-30
```

Local review URL:

```text
http://localhost:3000
```

### Progress Notes

- The first implementation intentionally keeps the database schema unchanged.
- Starter tasks are currently UI-only data derived from agent metadata, existing `starterPrompts`, and local fallback presets.
- Admin-managed agents can now store structured `starterTasks` in the database, and chat prefers those tasks before local preset logic.
- Known official-agent presets now take precedence over raw `starterPrompts` so the empty state can stay job-oriented even when seeded prompts are short or generic.
- Exact official agent names now resolve first, which prevents broad description keywords like `research` from stealing matches that belong to `General Assistant`.
- Empty-state task clicks prepare a prompt in the composer instead of submitting immediately.
- Desktop light/dark screenshots look visually stable after implementation.
- Mobile spacing was tightened in `agent-chat-empty-state.tsx` and `agent-task-card.tsx` to reduce empty-state collision with the composer.
- Guest-session fallback is now consistent: when no concrete agent has loaded, both the composer and empty state present the generic `Vaja AI` baseline instead of implying `General Assistant` is already selected.
- LINE broadcast tasks are draft-only by default; no irreversible send action is triggered from the empty state.
- This phase also touched agent schema, agent APIs, admin agent editor UI, and the shared empty-state resolver so the stored task definitions flow end to end.

## Current Touchpoints

Relevant files:

- `app/page.tsx`
  - Owns selected agent state.
  - Passes `agentName`, `agentDescription`, `starterPrompts`, and `generalStarterPrompts` into the message list.
  - Owns `handleSuggestionClick`, which currently submits a suggestion immediately.
- `features/chat/components/message-list/chat-message-list.tsx`
  - Renders the empty state when `messages.length === 0`.
  - Currently shows either selected-agent starter prompts or general starter prompts.
- `features/chat/components/message-list/types.ts`
  - Defines props for empty-state starter prompt data.
- `features/chat/components/composer/chat-composer.tsx`
  - Owns the composer UI and already has access to selected agent data.
- `features/agents/types.ts`
  - Defines the `Agent` shape used by chat and agent management.

Do not place empty-state business logic in API routes or the chat model route. This is presentation and prompt-starting UX, not model behavior.

## UX Principles

### 1. Start From Jobs, Not Examples

The first screen should answer:

> What can this agent help me finish today?

Avoid generic suggestions such as "Write a blog post" when a more Vaja-specific task is possible. For Thai SME and LINE-first workflows, tasks should name concrete channels, outputs, and work contexts.

Good:

- `เขียน Broadcast เปิดตัวสินค้าใหม่`
- `วางแผน Content Calendar 30 วัน`
- `ตอบแชตลูกค้าเรื่องราคาและจัดส่ง`
- `ทำโพสต์โปรโมชัน LINE OA 7 วัน`

Less useful:

- `Write content`
- `Help me market`
- `Brainstorm ideas`

### 2. Make Agent Identity Clear

The empty state should show:

- Agent icon or cover fallback.
- Agent name.
- One short capability sentence.
- Task cards generated from that agent's purpose.

For example:

```text
Marketing AI
ช่วยวางแผน สร้าง และปรับคอนเทนต์สำหรับ LINE OA, Facebook, Instagram และช่องทางขายของคุณ
```

### 3. Composer Remains the Primary Action

Task cards should support the composer, not replace it. The composer must remain visually dominant and always available.

Recommended behavior:

- Clicking a task card fills the composer with a strong prompt template.
- It does not auto-send by default.
- The user can edit business details before submitting.

Auto-send can be added later as an explicit power-user setting, but the default should teach better prompting and reduce accidental sends.

### 4. Progressive Density

Use this hierarchy:

1. Agent identity.
2. Four primary task cards.
3. Optional compact secondary task rows.
4. Small tip line.
5. Composer.

Avoid turning the first chat into a dashboard. The user came to chat.

## Recommended Layout

Desktop:

```text
Header
--------------------------------------------------

              [Agent Icon]
              Agent Name
              Short capability sentence

  Common Tasks
  [Task Card] [Task Card] [Task Card] [Task Card]

  More Jobs
  [compact row] [compact row]
  [compact row] [compact row]

--------------------------------------------------
Composer
```

Mobile:

```text
Header
--------------------------------------------------
[Agent Icon]
Agent Name
Short capability sentence

Common Tasks
[Task Card]
[Task Card]
[Task Card]
[Task Card]

More Jobs
[compact row]
[compact row]

Composer
```

Responsive rules:

- Use one column on mobile.
- Use two columns for task cards on medium screens if four cards feel cramped.
- Use four columns only when each card can keep readable text without truncating important labels.
- Secondary rows can become a single column on mobile.
- Ensure the empty-state content never overlaps the sticky composer.

## Component Architecture

Create focused components under:

```text
features/chat/components/empty-state/
```

Recommended files:

```text
features/chat/components/empty-state/
  agent-chat-empty-state.tsx
  agent-task-card.tsx
  agent-task-row.tsx
  task-starter-data.ts
  types.ts
```

### `AgentChatEmptyState`

Responsibilities:

- Render the empty-state layout.
- Receive selected agent metadata and task starters as props.
- Choose between agent-specific and general fallback content.
- Call `onSelectTask(task)` when a user chooses a starter.

It should not:

- Fetch agents.
- Mutate threads.
- Submit chat messages directly.
- Know about database shape beyond props.

### `AgentTaskCard`

Responsibilities:

- Render one primary task.
- Use a semantic `<button type="button">`.
- Include icon, title, short description, and arrow affordance.
- Provide visible hover and `focus-visible` states.

### `AgentTaskRow`

Responsibilities:

- Render compact secondary tasks.
- Use a semantic button.
- Preserve enough height for touch targets.
- Avoid layout shift when labels vary.

### `task-starter-data.ts`

Responsibilities:

- Provide fallback starter tasks for known agent categories.
- Keep static UI copy outside the rendering component.
- Export helpers that normalize `agent.starterPrompts` into richer task objects when possible.

Do not hardcode every official agent inside `chat-message-list.tsx`. Keep data mapping separate so it can evolve.

## Data Model

Current agents already have `starterPrompts: string[]`. That is enough for simple chips, but task cards need richer metadata.

Recommended UI-only type:

```typescript
export type AgentStarterTask = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: 'edit' | 'message' | 'search' | 'calendar' | 'mail' | 'refresh' | 'chart' | 'sparkles';
  priority: 'primary' | 'secondary';
  category?: string;
};
```

Short-term implementation:

- Keep database schema unchanged.
- Derive `AgentStarterTask[]` from:
  - agent name
  - agent description
  - existing `starterPrompts`
  - local fallback presets by agent category/name

Long-term implementation:

- Add a structured starter task field only if this UX proves valuable across many agents.
- Prefer a JSONB field such as `starterTasks` on `agent` only after validating admin/editor needs.
- Keep backward compatibility with `starterPrompts`.

## Starter Task Selection Rules

Task source priority:

1. Agent-specific structured tasks if added in the future.
2. Known preset by official agent/template name or category.
3. Existing `agent.starterPrompts` converted into simple task cards.
4. General Vaja fallback starters.

Recommended helper:

```typescript
export function getAgentStarterTasks(input: {
  agentName?: string | null;
  agentDescription?: string | null;
  starterPrompts?: string[];
}): AgentStarterTask[]
```

Rules:

- Return up to 4 primary tasks.
- Return up to 6 secondary tasks.
- Keep prompts specific enough to be useful but editable.
- Do not include destructive or irreversible tasks as one-click actions.
- Distribution tasks such as LINE broadcast should prepare a draft, not send.

## Prompt Fill Behavior

Change the task click behavior from "submit immediately" to "fill composer".

Recommended flow:

```text
User clicks task card
        ↓
Composer text is set to task.prompt
        ↓
Textarea receives focus on desktop
        ↓
User edits details
        ↓
User submits manually
```

Implementation approach:

- Add a controlled draft setter to the composer through `PromptInputProvider` or expose a small callback from `ChatComposer`.
- In `app/page.tsx`, separate these actions:
  - `handleSubmitSuggestion(text)` for follow-up suggestions inside completed conversations.
  - `handlePrepareStarterPrompt(text)` for empty-state task cards.
- Use `handlePrepareStarterPrompt` for empty-state tasks.
- Keep existing follow-up chips after assistant messages as submit-on-click if that interaction is still desired.

This avoids surprising users while preserving quick interaction after a conversation has already started.

## Suggested Starter Tasks

### Marketing AI

Primary:

| Title | Description | Prompt template |
|---|---|---|
| `เขียน Broadcast เปิดตัวสินค้าใหม่` | Draft a LINE OA broadcast for a product launch. | `ช่วยเขียน LINE OA Broadcast สำหรับเปิดตัวสินค้าใหม่ ชื่อสินค้า: [ใส่ชื่อสินค้า] กลุ่มลูกค้า: [ใส่กลุ่มลูกค้า] จุดขายหลัก: [ใส่จุดขาย] โทนภาษา: เป็นกันเองและชวนซื้อ` |
| `วางแผน Content Calendar 30 วัน` | Plan LINE, Facebook, and Instagram content. | `ช่วยวางแผน Content Calendar 30 วัน สำหรับธุรกิจ [ประเภทธุรกิจ] โดยใช้ช่องทาง LINE OA, Facebook และ Instagram พร้อมหัวข้อโพสต์ เป้าหมาย และ CTA ในแต่ละวัน` |
| `สร้าง Caption Facebook / Instagram` | Write social captions with hashtags. | `ช่วยเขียน caption สำหรับ Facebook และ Instagram จำนวน 5 แบบ สำหรับสินค้า/บริการ [รายละเอียด] โดยมี hashtag และ CTA ที่เหมาะกับลูกค้าไทย` |
| `ทำแคมเปญโปรโมชัน 7 วัน` | Build a short promotion campaign. | `ช่วยออกแบบแคมเปญโปรโมชัน 7 วัน สำหรับ [สินค้า/บริการ] โดยมีข้อความรายวันสำหรับ LINE OA และโพสต์ social พร้อมข้อเสนอและ CTA` |

Secondary:

- `วิเคราะห์คอนเทนต์คู่แข่ง`
- `แปลงโพสต์เก่าเป็นหลายช่องทาง`
- `เขียน Landing Page Copy`
- `ทำ Email Newsletter`
- `สร้างสคริปต์วิดีโอสั้น`
- `คิดไอเดียโพสต์เทศกาล`

### LINE OA Agent

Primary:

- `ตอบแชตลูกค้าเรื่องราคาและจัดส่ง`
- `ร่าง Broadcast แจ้งโปรโมชัน`
- `ออกแบบ Rich Menu`
- `แบ่งกลุ่มลูกค้าสำหรับ Broadcast`

Secondary:

- `เขียนข้อความต้อนรับเพื่อนใหม่`
- `ทำ FAQ สำหรับแอดมิน`
- `วาง Journey ลูกค้าหลังแอด LINE`
- `สรุป Insight จากแชตลูกค้า`

### Research & Summary Agent

Primary:

- `สรุปเอกสารเป็นข้อเสนอ`
- `ค้นคว้าคู่แข่งพร้อมแหล่งอ้างอิง`
- `ทำ Market Scan`
- `เปรียบเทียบตัวเลือกพร้อมข้อดีข้อเสีย`

Secondary:

- `ดึง Action Items จากเอกสาร`
- `ทำ Executive Summary`
- `แปลงข้อมูลเป็น FAQ`
- `ตรวจช่องว่างของข้อมูล`

### General Fallback

Primary:

- `ช่วยตอบลูกค้า LINE`
- `วางไอเดียคอนเทนต์สัปดาห์นี้`
- `สรุปไฟล์หรือข้อความ`
- `ร่างข้อความส่งงาน`

## Visual Design Guidance

Use existing shadcn/ui and Tailwind patterns. Do not modify `components/ui/`.

Recommended style:

- Calm app surface, not marketing hero.
- 8px radius or existing design-system radius for task cards.
- Icons from `lucide-react`.
- Four primary cards with clear affordance.
- Compact secondary rows for advanced jobs.
- Avoid nested cards inside page cards.
- Avoid decorative gradient blobs or ornamental backgrounds.
- Keep color accents per task subtle and varied, not a one-note purple screen.

Task card anatomy:

```text
[icon]
Title
Short description
                                [arrow]
```

Accessibility:

- Use `<button type="button">` for task cards.
- Add visible `hover`, `active`, and `focus-visible` states.
- Icon-only controls need `aria-label`.
- Decorative icons need `aria-hidden="true"`.
- Preserve keyboard navigation order from top to bottom.
- Touch targets should be at least 44px high.
- Respect reduced-motion if adding transitions.

Content handling:

- Titles should fit in two lines.
- Descriptions should fit in two to three lines.
- Use `min-w-0`, `line-clamp`, or `break-words` where needed.
- Thai copy should not be squeezed into tiny cards on mobile.

## Localization and Copy

Default copy should be Thai-first with selective English product terms where users expect them:

- Keep `LINE OA`, `Broadcast`, `Content Calendar`, `Caption`, `CTA`, and platform names untranslated.
- Use active, work-oriented Thai.
- Avoid explaining the UI inside the UI.
- Prefer "ช่วย..." prompts because they naturally map to chat behavior.

Header examples:

```text
New chat
เริ่มจากงานจริงที่อยากให้ Vaja ช่วยทำ
```

Agent capability examples:

```text
Marketing AI
ช่วยวางแผน สร้าง และปรับคอนเทนต์สำหรับ LINE OA, Facebook, Instagram และช่องทางขายของคุณ
```

Composer placeholder examples:

```text
อยากให้ Vaja ช่วยอะไร?
What content can I help you create today?
```

Use one language direction per surface where possible. If the current product surface is Thai-first, keep the empty state Thai-first.

## Maintainability Rules

- Keep task definitions data-driven.
- Keep render components dumb and prop-based.
- Keep prompt templates editable in one place.
- Avoid branching deeply on agent names inside JSX.
- Do not duplicate starter task logic between composer and message list.
- Do not add new database fields until UI behavior has stabilized.
- Do not mix agent skill activation logic with empty-state task rendering.
- Use `@/` imports.
- Use `pnpm` for validation commands.

Suggested ownership:

| Concern | File |
|---|---|
| Layout rendering | `features/chat/components/empty-state/agent-chat-empty-state.tsx` |
| Card UI | `features/chat/components/empty-state/agent-task-card.tsx` |
| Static fallback tasks | `features/chat/components/empty-state/task-starter-data.ts` |
| Types | `features/chat/components/empty-state/types.ts` |
| Composer draft bridge | `features/chat/components/composer/chat-composer.tsx` |
| Wiring selected agent to empty state | `app/page.tsx` |

## Testing Checklist

Run:

```bash
pnpm exec tsc --noEmit
pnpm build
```

Manual checks:

- New chat with selected Marketing AI shows agent-specific task cards.
- New chat with no selected agent shows general Vaja tasks.
- Clicking an empty-state task fills the composer but does not send.
- Follow-up suggestions in an existing conversation still behave as intended.
- Switching agents updates the empty-state task set.
- Mobile layout does not overlap the composer.
- Long Thai labels do not overflow cards.
- Keyboard users can tab through all task cards and activate them.
- Screen readers receive meaningful button names.
- LINE broadcast tasks only prepare drafts; they do not send messages.
- Dark mode remains readable.

## Implementation Checklist

- `[x]` Create empty-state component folder under `features/chat/components/empty-state/`.
- `[x]` Add `AgentStarterTask` types.
- `[x]` Add fallback task data for Marketing AI, LINE OA Agent, Research & Summary Agent, and general Vaja.
- `[x]` Replace the inline empty-state JSX in `chat-message-list.tsx` with `AgentChatEmptyState`.
- `[x]` Add a composer draft-fill callback instead of using submit-on-click for empty-state starters.
- `[x]` Keep follow-up chips after assistant responses separate from empty-state starter tasks.
- `[~]` Verify responsive layout and dark mode.
- `[x]` Run type-check and build.

## Future Enhancements

- Let admin-managed agents define structured starter tasks in the agent editor.
- Track which starter tasks are clicked to improve default task ordering.
- Personalize tasks based on connected channels, enabled tools, and active skills.
- Show required setup hints only when a task depends on missing configuration.
- Add a command palette style "More tasks" picker for agents with many capabilities.
