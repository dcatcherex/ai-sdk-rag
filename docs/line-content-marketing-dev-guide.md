# LINE × Content Marketing — Developer & AI Coder Guide

This guide covers the architecture, key files, extension patterns, and maintenance notes for the LINE + Content Marketing integration built in this project.

Read this before modifying any LINE webhook, agent tool, approval flow, or analytics code.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Map](#2-directory-map)
3. [Database Schema Reference](#3-database-schema-reference)
4. [LINE Webhook Pipeline](#4-line-webhook-pipeline)
5. [Agent Tool System](#5-agent-tool-system)
6. [Approval & Notification Pipeline](#6-approval--notification-pipeline)
7. [Distribution Pipeline](#7-distribution-pipeline)
8. [Analytics Pipeline](#8-analytics-pipeline)
9. [Adding a New LINE Agent Capability](#9-adding-a-new-line-agent-capability)
10. [Adding a New Agent Template](#10-adding-a-new-agent-template)
11. [Common Mistakes & Gotchas](#11-common-mistakes--gotchas)
12. [Environment Variables](#12-environment-variables)
13. [Migration Workflow](#13-migration-workflow)

---

## 1. Architecture Overview

```
LINE Webhook Event
    │
    ▼
app/api/line/[channelId]/route.ts
    │  (signature verification)
    │
    ▼
features/line-oa/webhook/index.ts          ← event dispatcher
    │
    ├── handleFollowEvent()                 ← new followers
    ├── handleMessageEvent()               ← text + images
    │       │
    │       ├── buildContentMarketingLineTools()    content_marketing
    │       ├── buildContentPlannerLineTools()      content_planning
    │       └── buildLineMetricsTools()             line_analytics
    │
    └── handlePostbackEvent()              ← button taps
            │
            ├── switch_menu:<id>
            ├── switch_agent:<id>
            ├── approve_content:<id>
            ├── reject_content:<id>
            └── request_changes:<id>
```

The webhook handler is the single entry point for all LINE events. It:
- Loads the channel config and resolves the effective agent (user session override → channel default)
- Calls the appropriate event handler
- Every event handler is a pure async function — no side effects outside its own file

---

## 2. Directory Map

```
features/line-oa/
├── analytics.ts                    ← recordMessageEvent(), getChannelStats()
├── metrics-tools.ts                ← buildLineMetricsTools(userId, channelId)
├── broadcast/
│   └── service.ts                  ← createBroadcast(), sendBroadcast()
├── components/                     ← React UI components (dashboard only)
├── hooks/
│   └── use-line-oa.ts              ← TanStack Query hooks
├── link/
│   └── service.ts                  ← generateLinkToken(), consumeLinkToken()
├── notifications/
│   └── approval.ts                 ← notifyAssigneeViaLine(), notifyRequesterViaLine()
└── webhook/
    ├── index.ts                    ← POST handler, event dispatcher
    ├── types.ts                    ← AgentRow, LinkedUser, Sender, LineMessage
    ├── db.ts                       ← getOrCreateConversation()
    ├── flex.ts                     ← buildReplyMessages() — Flex vs plain text
    ├── rich-menu.ts                ← setUserRichMenu()
    ├── events/
    │   ├── message.ts              ← handleMessageEvent()
    │   └── postback.ts             ← handlePostbackEvent()
    └── utils/
        ├── markdown.ts             ← stripMarkdown()
        ├── quick-reply.ts          ← buildQuickReplyItem()
        └── text.ts                 ← extractTextContent()

features/content-marketing/
├── line-tools.ts                   ← buildContentMarketingLineTools(userId)
├── service.ts                      ← generateCaptions(), createPost(), publishPost()
├── schema.ts                       ← Zod input schemas
├── types.ts                        ← SocialPostRecord, TrendItem, etc.
└── ...

features/content-calendar/
├── line-tools.ts                   ← buildContentPlannerLineTools(userId)
├── service.ts                      ← createCampaignBrief(), createCalendarEntry()
└── types.ts

features/collaboration/
└── service.ts                      ← createApprovalRequest(), resolveApprovalRequest()

features/distribution/
├── components/
│   └── distribution-panel.tsx      ← tabbed UI: email / export / webhook / LINE / history
├── hooks/
│   └── use-distribution.ts         ← useSendLineBroadcast(), useExportContent(), etc.
└── types.ts

features/analytics/
├── service.ts                      ← trackMetric(), getContentPerformanceSummary()
└── types.ts

app/api/line/[channelId]/route.ts   ← webhook entry point
app/api/distribution/
├── line-broadcast/route.ts         ← POST: broadcast content piece to LINE followers
├── email/route.ts
├── export/route.ts
└── webhook/route.ts
```

---

## 3. Database Schema Reference

All tables are defined in `db/schema/` and re-exported from `db/schema.ts`.

### LINE OA Tables (`db/schema/line-oa.ts`)

| Table | PK | Key Columns | Notes |
|---|---|---|---|
| `lineOaChannel` | `id` | `userId`, `agentId`, `channelAccessToken`, `channelSecret` | One per LINE OA channel |
| `lineConversation` | `id` | `channelId`, `lineUserId`, `threadId` | Maps LINE user → chat thread |
| `lineRichMenu` | `id` | `channelId`, `lineMenuId`, `areas` (JSONB), `isDefault` | Rich menu per channel |
| `lineUserMenu` | `id` | `channelId`, `lineUserId`, `lineMenuId` | Active menu per LINE user |
| `lineBroadcast` | `id` | `channelId`, `status`, `recipientCount`, `sentAt` | Broadcast records |
| `lineAccountLinkToken` | `id` | `token` (unique), `expiresAt`, `usedAt` | 8-char link tokens, 15min TTL |
| `lineAccountLink` | `id` | `userId`, `channelId`, `lineUserId` | Permanent app ↔ LINE link |
| `lineUserAgentSession` | `id` | `channelId`, `lineUserId`, `activeAgentId` | Active agent override per user |
| `lineChannelDailyStat` | `id` | `channelId`, `date`, `messageCount`, `uniqueUsers`, `toolCallCount` | Daily rollup |
| `lineChannelDailyUser` | `id` | `channelId`, `date`, `lineUserId` | Unique user deduplication |

**Unique constraints to know:**
- `lineUserAgentSession`: UNIQUE(`channelId`, `lineUserId`)
- `lineChannelDailyStat`: UNIQUE(`channelId`, `date`)
- `lineChannelDailyUser`: UNIQUE(`channelId`, `date`, `lineUserId`)
- `lineAccountLink`: effectively unique per (`userId`, `channelId`)

### Planning Tables (`db/schema/planning.ts`)

| Table | Key Columns |
|---|---|
| `campaignBrief` | `userId`, `brandId?`, `title`, `goal`, `channels[]`, `startDate`, `endDate`, `status` |
| `contentCalendarEntry` | `userId`, `campaignId?`, `contentPieceId?`, `title`, `contentType`, `plannedDate`, `status` |

### Collaboration Tables (`db/schema/collaboration.ts`)

| Table | Key Columns |
|---|---|
| `workspaceMember` | `brandId`, `userId`, `role` ('admin'/'writer'/'editor'/'reviewer') |
| `approvalRequest` | `contentPieceId`, `requesterId`, `assigneeId?`, `status`, `resolvedAt` |
| `contentComment` | `contentPieceId`, `userId`, `parentId?`, `body`, `resolved` |

### Analytics Tables (`db/schema/analytics.ts`)

| Table | Key Columns |
|---|---|
| `contentPieceMetric` | `contentPieceId`, `userId`, `platform`, `views`, `clicks`, `impressions`, `engagement` |
| `distributionRecord` | `contentPieceId`, `userId`, `channel`, `status`, `recipientCount`, `sentAt` |
| `abVariant` | `contentPieceId`, `userId`, `variantLabel`, `body`, `impressions`, `clicks` |

---

## 4. LINE Webhook Pipeline

### Entry Point

`app/api/line/[channelId]/route.ts` verifies the `X-Line-Signature` header using HMAC-SHA256 and hands off to `features/line-oa/webhook/index.ts`.

**Signature verification must never be disabled — LINE will reject requests without it.**

### Event Dispatcher (`webhook/index.ts`)

Loads in order:
1. Channel config (`lineOaChannel`) — fails fast if not found
2. Sender info (brand logo via `brandAsset`)
3. For message events: checks `lineAccountLink` + `lineUserAgentSession` in parallel
4. If user has an active agent session → overrides channel's default agent

**Key pattern — effective agent resolution:**
```typescript
// Default: use channel's configured agent
let effectiveAgentRow = channelAgentRow;

// User session override (set by switch_agent postback)
if (activeAgentId && activeAgentId !== channel.agentId) {
  const [userAgent] = await db.select().from(agent).where(eq(agent.id, activeAgentId)).limit(1);
  if (userAgent) effectiveAgentRow = userAgent; // overrides system prompt, model, tools
}
```

### Message Handler (`webhook/events/message.ts`)

Processes text and image messages through these branches:

```
msgType === 'image'  → vision model → text reply
msgType === 'text'
    └── wantsImageGeneration(text)?
        ├── yes → generateImage → R2 → LINE image message
        └── no  → generateText (with optional tools)
                    └── toolResults[].output.imageUrl? → append LINE image messages
```

**Tool injection:**
```typescript
const enabledTools = agentRow?.enabledTools ?? [];
// Each flag adds its tool set to the merged object
const mergedTools = {
  ...( enabledTools.includes('content_marketing') ? buildContentMarketingLineTools(userId) : {} ),
  ...( enabledTools.includes('content_planning')  ? buildContentPlannerLineTools(userId)   : {} ),
  ...( enabledTools.includes('line_analytics')    ? buildLineMetricsTools(userId, channelId) : {} ),
};
```

**After every handled message:**
```typescript
recordMessageEvent(channel.id, lineUserId, { toolCallCount, imagesSent }).catch(() => {});
```
This is fire-and-forget — never await it in the critical path.

### Postback Handler (`webhook/events/postback.ts`)

Dispatches on `event.postback.data` prefix:

| Prefix | Action |
|---|---|
| `switch_menu:<id>` | Assign rich menu to LINE user |
| `switch_agent:<id>` | Upsert `lineUserAgentSession` |
| `switch_agent:default` | Clear `lineUserAgentSession.activeAgentId` |
| `approve_content:<id>` | `resolveApprovalRequest(id, resolverId, { status: 'approved' })` |
| `reject_content:<id>` | `resolveApprovalRequest(id, resolverId, { status: 'rejected' })` |
| `request_changes:<id>` | `resolveApprovalRequest(id, resolverId, { status: 'changes_requested' })` |

For approval actions, `resolverId` is looked up from `lineAccountLink`. If the user is not linked, `lineUserId` is used as a fallback (this means the `resolveApprovalRequest` ownership check may fail — expected behavior).

---

## 5. Agent Tool System

### Tool Factory Pattern

Every set of LINE tools follows this pattern:

```typescript
// features/<feature>/line-tools.ts

export function build<Feature>LineTools(userId: string | null /*, ...other context */) {
  return {
    tool_name: tool({
      description: '...',
      inputSchema: z.object({ ... }),   // ← inputSchema, NOT parameters
      execute: async (args) => {
        if (!userId) return { success: false, message: NOT_LINKED_MSG };
        // ... call service.ts functions
        return { success: true, ... };
      },
    }),
  };
}
```

**Critical:** Use `inputSchema` not `parameters`. The AI SDK v4+ uses `inputSchema` for tool definitions. Using `parameters` silently fails.

**Critical:** Access tool outputs via `toolResults[].output`, not `.result`.

### Available Tool Sets

| Export | File | `enabledTools` key | Tools |
|---|---|---|---|
| `buildContentMarketingLineTools` | `features/content-marketing/line-tools.ts` | `content_marketing` | `generate_caption`, `generate_image`, `save_draft`, `list_drafts` |
| `buildContentPlannerLineTools` | `features/content-calendar/line-tools.ts` | `content_planning` | `create_campaign`, `list_campaigns`, `add_calendar_entry`, `list_upcoming_entries` |
| `buildLineMetricsTools` | `features/line-oa/metrics-tools.ts` | `line_analytics` | `list_recent_content`, `log_content_metric`, `get_content_performance`, `get_channel_stats` |

### maxSteps

`generateText` is called with `maxSteps: 3` when tools are present. This allows:
- Step 1: Tool call (e.g. `list_campaigns`)
- Step 2: Second tool call using result (e.g. `add_calendar_entry` with the campaignId)
- Step 3: Final text response

Do not increase this without considering LINE's 30-second reply timeout — more steps = more latency.

### Image URL Collection

After `generateText`, image URLs from tool results are collected and sent as separate LINE image messages:

```typescript
const toolImageUrls: string[] = (generateResult.toolResults ?? [])
  .flatMap((tr) => {
    const r = (tr as { output?: Record<string, unknown> }).output;
    return r?.imageUrl && typeof r.imageUrl === 'string' ? [r.imageUrl] : [];
  });
```

LINE limits reply messages to 5 per reply. Text messages are built first; images fill remaining slots (`Math.max(0, 4 - textMessages.length)`).

---

## 6. Approval & Notification Pipeline

### Flow

```
createApprovalRequest()
    ├── DB insert: approvalRequest (status: 'pending')
    ├── DB update: contentPiece.status → 'in_review'
    ├── Email → assignee (Resend)
    └── notifyAssigneeViaLine(assigneeId, request, contentTitle)  [fire-and-forget]
            └── Looks up ALL lineAccountLink rows for assigneeId
                (user may be linked to multiple channels)
                For each: MessagingApiClient.pushMessage() with quick reply buttons
```

```
resolveApprovalRequest()
    ├── DB update: approvalRequest.status
    ├── DB update: contentPiece.status → 'approved' | 'draft'
    ├── Email → requester (Resend)
    └── notifyRequesterViaLine(requesterId, resolution, contentTitle)  [fire-and-forget]
```

### Notification File

`features/line-oa/notifications/approval.ts`

- `getLinkedChannels(userId)` — joins `lineAccountLink` + `lineOaChannel` to get `(channelAccessToken, lineUserId)` pairs
- Both notification functions use `Promise.allSettled()` — one failed push never blocks others
- Always catch errors at the call site in `service.ts` — notifications must never throw to callers

### Postback Resolution

When a reviewer taps a quick-reply button in LINE:
1. Postback data: `approve_content:{requestId}` / `reject_content:{requestId}` / `request_changes:{requestId}`
2. `handlePostbackEvent` looks up `lineAccountLink` → gets `resolverId`
3. Calls `resolveApprovalRequest(requestId, resolverId, { status })`
4. `resolveApprovalRequest` checks `current.status === 'pending'` — rejects double-actions with an error message sent back to LINE

---

## 7. Distribution Pipeline

### LINE Broadcast Route

`app/api/distribution/line-broadcast/route.ts`

```
POST { contentPieceId, channelId }
    │  Verifies: contentPiece.userId === session.user.id
    │
    ▼
toPlainText(rawText)           ← strips markdown (#, **, *, `, links, lists)
    │  Prefer: excerpt → body → title
    │  Slice to 2000 chars (LINE message limit)
    │
    ▼
createBroadcast(channelId, userId, { name, messageText })
    │
    ▼
sendBroadcast(broadcastId, userId)
    │  LINE Broadcast API → all followers
    │
    ▼
DB insert: distributionRecord { channel: 'line_broadcast', status: 'sent', recipientCount }
```

On error: logs a `distributionRecord` with `status: 'failed'` and returns 500. The failed record appears in the Distribution History tab.

### Distribution Panel UI

`features/distribution/components/distribution-panel.tsx`

Tabs: Email | Export | Webhook | LINE | History

The LINE tab (`features/line-oa/hooks/use-line-oa.ts` → `useLineOaChannels()`) populates the channel dropdown. Uses `useSendLineBroadcast()` mutation from `features/distribution/hooks/use-distribution.ts`.

---

## 8. Analytics Pipeline

### Auto-Recording (Passive)

Every processed message event fires `recordMessageEvent(channelId, lineUserId, opts)` after reply is sent.

```typescript
// features/line-oa/analytics.ts
export async function recordMessageEvent(channelId, lineUserId, opts = {}) {
  const date = todayStr(); // YYYY-MM-DD

  // 1. Upsert daily-user row (idempotent — unique constraint on channelId+date+lineUserId)
  await db.insert(lineChannelDailyUser).values(...).onConflictDoNothing();

  // 2. Count distinct users for today
  const uniqueUsers = COUNT(*) from lineChannelDailyUser WHERE channelId AND date;

  // 3. Upsert daily stat row — increment counters
  await db.insert(lineChannelDailyStat).values(...)
    .onConflictDoUpdate({ set: {
      messageCount: messageCount + 1,
      uniqueUsers: <fresh count>,
      toolCallCount: toolCallCount + opts.toolCallCount,
      imagesSent: imagesSent + opts.imagesSent,
    }});
}
```

This is called fire-and-forget (`recordMessageEvent(...).catch(() => {})`). It must never block the reply path.

### Manual Logging (Agent Tools)

Via `buildLineMetricsTools()`:
- `log_content_metric` → calls `trackMetric(userId, input)` from `features/analytics/service.ts`
- `get_content_performance` → calls `getContentPerformanceSummary(userId, contentPieceId)`
- `get_channel_stats` → calls `getChannelStats(channelId, days)` from `features/line-oa/analytics.ts`

### Analytics Data Flow

```
LINE message event
    └── recordMessageEvent() → lineChannelDailyStat + lineChannelDailyUser

User reports "5000 views"
    └── log_content_metric tool → contentPieceMetric

Content published via distribution
    └── distributionRecord { channel, status, recipientCount, sentAt }
```

All three streams can be queried from the Dashboard Analytics section.

---

## 9. Adding a New LINE Agent Capability

Follow these 4 steps:

### Step 1 — Create a tool factory file

```typescript
// features/<feature>/line-tools.ts

import { tool } from 'ai';
import { z } from 'zod';
import { someServiceFunction } from './service';

export function build<Feature>LineTools(userId: string | null) {
  return {
    my_tool_name: tool({
      description: 'What this tool does and when the agent should call it.',
      inputSchema: z.object({          // ← MUST be inputSchema, not parameters
        param1: z.string().describe('...'),
      }),
      execute: async ({ param1 }) => {
        if (!userId) return { success: false, message: 'Link your account first with /link TOKEN.' };
        const result = await someServiceFunction(userId, param1);
        return { success: true, data: result, message: 'Human-readable summary for the agent.' };
      },
    }),
  };
}
```

### Step 2 — Wire into the message handler

`features/line-oa/webhook/events/message.ts`:

```typescript
// 1. Import the factory
import { buildMyFeatureLineTools } from '@/features/<feature>/line-tools';

// 2. Add detection flag
const isMyFeatureAgent = enabledTools.includes('my_feature_key');

// 3. Build tools
const myFeatureTools = isMyFeatureAgent
  ? buildMyFeatureLineTools(linkedUser?.userId ?? null)
  : undefined;

// 4. Merge into mergedTools
const mergedTools = (contentTools || plannerTools || metricsTools || myFeatureTools)
  ? { ...contentTools, ...plannerTools, ...metricsTools, ...myFeatureTools }
  : undefined;
```

### Step 3 — Create an agent template migration

```sql
-- db/migrations/XXXX_my_feature_agent_template.sql

INSERT INTO agent (id, user_id, name, description, system_prompt, model_id,
  is_template, enabled_tools, starter_prompts, created_at, updated_at)
VALUES (
  'tpl_my_feature_agent', NULL,
  'My Feature Agent',
  'Short description shown in the agent picker.',
  'System prompt. Include: what you do, what tools to use when, output format (plain text, no markdown, use • for lists).',
  'google/gemini-2.5-flash-lite',
  TRUE,
  ARRAY['my_feature_key'],
  ARRAY['Starter prompt 1', 'Starter prompt 2'],
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET ... ;
```

Apply with: `node --env-file=.env.local -e "require('postgres')(process.env.DATABASE_URL).unsafe(require('fs').readFileSync('./db/migrations/XXXX_...sql','utf8')).then(sql=>sql.end())"`

### Step 4 — Add the enabledTools key to the system prompt

The agent's system prompt should reference the tool names explicitly so the AI knows when to call them.

---

## 10. Adding a New Agent Template

Templates are rows in the `agent` table with `is_template = TRUE` and `user_id = NULL`.

They appear in the "Templates" section of the Agents page and can be used as:
- A pre-configured agent attached to a LINE OA channel
- A starting point users can clone and customize

**Required fields:**
```sql
id              -- 'tpl_<descriptive_name>' (stable, used in migrations)
user_id         -- NULL (marks as template)
is_template     -- TRUE
name            -- Short name (shown in UI)
description     -- One-sentence description
system_prompt   -- Full system prompt (include LINE output format guidance)
model_id        -- e.g. 'google/gemini-2.5-flash-lite'
enabled_tools   -- text[] of tool keys
starter_prompts -- text[] of 3 suggested prompts
```

---

## 11. Common Mistakes & Gotchas

### AI SDK Tool API

| Wrong | Correct |
|---|---|
| `parameters: z.object({...})` | `inputSchema: z.object({...})` |
| `toolResults[i].result` | `toolResults[i].output` |
| `import { tool } from '@ai-sdk/openai'` | `import { tool } from 'ai'` |

### LINE API Limits

| Limit | Value | Where it matters |
|---|---|---|
| Reply messages per reply | 5 | `buildReplyMessages` + image append logic |
| Quick reply items | 13 | Approval notifications (3 items — safe) |
| Message text length | 5000 chars | Broadcast uses 2000 cap |
| `showLoadingAnimation` seconds | 20–60 | Set to 30 in message handler |

### Fire-and-Forget Pattern

Non-critical async operations (notifications, analytics recording) must always be fire-and-forget:
```typescript
// Correct — never throws to caller
someAsyncOp().catch((err) => console.warn('[context]', err));
void someAsyncOp();

// Wrong — blocks the reply and can crash the handler
await someAsyncOp();
```

This applies to:
- `recordMessageEvent()`
- `notifyAssigneeViaLine()`
- `notifyRequesterViaLine()`
- `extractAndStoreMemory()`

### Linked vs Non-Linked Users

Many tool factories accept `userId: string | null`. Tools that write data should return a helpful error when `userId` is null. Tools that read public/channel data may still work.

Pattern:
```typescript
const NOT_LINKED_MSG = 'Your LINE account is not linked. Type /link TOKEN...';
execute: async (args) => {
  if (!userId) return { success: false, message: NOT_LINKED_MSG };
  // proceed with DB operations
}
```

### Agent Session Precedence

```
lineUserAgentSession.activeAgentId  (highest — user switched via rich menu)
    → lineOaChannel.agentId         (channel default)
    → no agent                      (falls back to generic AI with no tools)
```

Always check `lineUserAgentSession` BEFORE using `channel.agentId` in new code.

### Rich Menu Action Types

When building rich menus, `switch_agent` is a custom action type defined in this codebase (not a native LINE type). It is converted to a LINE `postback` action in `features/line-oa/webhook/rich-menu/builder.ts`:

```typescript
// builder.ts
case 'switch_agent':
  return { type: 'postback', data: `switch_agent:${action.agentId}`, label: area.label };
```

Do not send `type: 'switch_agent'` directly to the LINE API — it will reject it.

### Markdown Stripping

LINE does not render markdown. All AI replies must be stripped before sending:
```typescript
const replyText = stripMarkdown(rawReplyText);
```

The system prompt also tells the AI explicitly: "Do NOT use markdown syntax."

If you add a new message path, always apply `stripMarkdown()` before `replyMessage()`.

---

## 12. Environment Variables

| Variable | Used By | Notes |
|---|---|---|
| `DATABASE_URL` | Drizzle / Neon | All DB operations |
| `BETTER_AUTH_SECRET` | Auth session signing | |
| `OPENAI_API_KEY` | Image generation (`gpt-image-1.5`) | Via OpenRouter or direct |
| `R2_ACCOUNT_ID` | Image uploads | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Image uploads | |
| `R2_SECRET_ACCESS_KEY` | Image uploads | |
| `R2_BUCKET_NAME` | Image uploads | |
| `R2_PUBLIC_URL` | Public image URLs sent to LINE | Must be publicly accessible |
| `RESEND_API_KEY` | Email notifications in approval flow | |
| `GOOGLE_CLIENT_ID` | Optional — Google OAuth | |
| `COHERE_API_KEY` | Optional — RAG reranking | |

LINE channel credentials (`channelSecret`, `channelAccessToken`) are stored **in the database** (`lineOaChannel` table), not in environment variables. They are loaded per-request from the channel config.

---

## 13. Migration Workflow

The project uses Drizzle ORM but applies migrations directly via a Postgres client (drizzle-kit has schema conflict issues with existing tables).

### Apply a migration

```bash
node --env-file=.env.local -e "
const postgres = require('postgres');
const fs = require('fs');
const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('./db/migrations/<filename>.sql', 'utf8');
sql.unsafe(migration)
  .then(() => { console.log('Applied'); sql.end(); })
  .catch(e => { console.error(e.message); sql.end(); });
"
```

### Naming convention

```
db/migrations/
  0001_initial.sql
  0038_content_planner_agent_template.sql   ← use sequential numbering
  0039_line_channel_analytics.sql
```

### After schema changes

1. Update `db/schema/<file>.ts`
2. Update `db/schema.ts` barrel if adding a new schema file
3. Write raw SQL migration (no drizzle-kit generate — it conflicts)
4. Apply migration with the node script above
5. Run `pnpm exec tsc --noEmit` to verify no type errors

---

## Applied Migrations (LINE + Content Marketing)

| File | Contents |
|---|---|
| `0035_social_marketing_image_agent_template.sql` | `tpl_social_image` agent template |
| `0036_line_user_agent_session.sql` | `line_user_agent_session` table |
| `0037_line_content_creator_template.sql` | `tpl_line_content_creator` agent template |
| `0038_content_planner_agent_template.sql` | `tpl_content_planner` agent template |
| `0039_line_channel_analytics.sql` | `line_channel_daily_stat`, `line_channel_daily_user` tables, `tpl_metrics_reporter` template |
