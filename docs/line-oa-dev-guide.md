# LINE OA Integration — Developer & AI Coder Guide

This guide covers every layer of the LINE Official Account integration in Vaja AI — architecture, data model, all webhook capabilities, multimodal I/O, account linking, payments, and extension patterns.

Read this before touching any webhook handler, LINE service, or LINE-related schema.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Map](#2-directory-map)
3. [Database Schema Reference](#3-database-schema-reference)
4. [Webhook Pipeline (Deep Dive)](#4-webhook-pipeline-deep-dive)
5. [Message Handler — Full Capability Map](#5-message-handler--full-capability-map)
6. [Multimodal I/O](#6-multimodal-io)
7. [Account Linking & LINE-Native Registration](#7-account-linking--line-native-registration)
8. [PromptPay Payment Flow](#8-promptpay-payment-flow)
9. [Rich Menu System](#9-rich-menu-system)
10. [Broadcast & Narrowcast](#10-broadcast--narrowcast)
11. [Analytics Pipeline](#11-analytics-pipeline)
12. [Agent Selection per User](#12-agent-selection-per-user)
13. [Skills Engine in LINE OA](#13-skills-engine-in-line-oa)
14. [Adding a New Text Command](#14-adding-a-new-text-command)
15. [Adding a New Postback Action](#15-adding-a-new-postback-action)
16. [Adding a New LINE Agent Tool](#16-adding-a-new-line-agent-tool)
17. [Common Mistakes & Gotchas](#17-common-mistakes--gotchas)
18. [Environment Variables](#18-environment-variables)
19. [LINE API Limits Reference](#19-line-api-limits-reference)
20. [Improvement Roadmap](#20-improvement-roadmap)

---

## 1. Architecture Overview

```
User sends message to LINE OA
          │
          ▼
app/api/line/[channelId]/route.ts        ← re-exports POST from webhook/index.ts
          │
          │  1. Read raw body
          │  2. Look up lineOaChannel by channelId
          │  3. Verify HMAC-SHA256 signature (validateSignature)
          │  4. Load agent config + brand logo
          │  5. Init MessagingApiClient
          │
          ▼
features/line-oa/webhook/index.ts        ← event dispatcher
          │
          ├── 'follow' ──────────────────► events/follow.ts
          │                                  └── buildWelcomeFlex() → replyMessage
          │
          ├── 'message' ─────────────────► resolve linkedUser + activeAgentSession
          │                                  │
          │                                  ▼
          │                               resolve effective agent (channel default → user override)
          │                                  │
          │                                  ▼
          │                               Skills Engine injection  ← NEW
          │                               ├── getSkillsForAgent()           load attached skills
          │                               ├── detectTriggeredSkills()        always/slash/keyword
          │                               ├── selectModelDiscoveredSkills()  top-2 model-scored
          │                               ├── buildAvailableSkillsCatalog()  Tier 1 catalog
          │                               └── active skills → Tier 2: <active_skills> in systemPrompt
          │                                  │
          │                                  ▼
          │                               events/message.ts
          │                                  ├── /link <token>      (consumeLinkToken)
          │                                  ├── สมัครสมาชิก         (registerLineUser)
          │                                  ├── เติมเครดิต / 1-4    (payment flow)
          │                                  ├── image input         (vision → text)
          │                                  │     └── slip image    (verifySlipAndCredit)
          │                                  ├── audio input         (transcribe → text + TTS)
          │                                  ├── video input         (preview frame → vision)
          │                                  ├── image-gen text      (generateImage → R2 → LINE)
          │                                  ├── video-gen text      (KIE Veo → fire-and-forget)
          │                                  └── standard text       (generateText → Flex/plain)
          │
          └── 'postback' ────────────────► events/postback.ts
                                             ├── switch_menu:<id>
                                             ├── switch_agent:<id>
                                             ├── approve_content:<id>
                                             ├── reject_content:<id>
                                             └── request_changes:<id>
```

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| Single entry per channel | One URL per LINE OA: `/api/line/[channelId]` |
| Signature-first | Every request verified before any DB work |
| 30-second webhook window | Sync reply → fire-and-forget for long ops (TTS, video, QR upload) |
| Stateless handlers | Each event handler is a pure async function — no module-level state |
| Ownership checks everywhere | Every service function verifies `channelId` → `userId` before mutating |

---

## 2. Directory Map

```
app/api/line/
  [channelId]/
    route.ts                    ← re-exports POST from webhook/index.ts
    webhook/                    ← LINE webhook verification endpoint (optional second path)

app/api/line-oa/
  [id]/                         ← channel CRUD (get, update, delete)
  menu-templates/               ← rich menu templates API
  route.ts                      ← list + create channels

features/line-oa/
  analytics.ts                  ← recordMessageEvent(), getChannelStats()
  metrics-tools.ts              ← AI tool wrappers for analytics queries
  types.ts                      ← LineOaChannel type (app-level)

  broadcast/
    service.ts                  ← listBroadcasts, createBroadcast, sendBroadcast, etc.

  link/
    service.ts                  ← generateLinkToken, consumeLinkToken, registerLineUser
                                    listLinks, deleteLink, pushToLinkedUser, pushToAllLinkedUsers

  payment/
    packages.ts                 ← CREDIT_PACKAGES, formatPackageMenu()
    service.ts                  ← createPaymentOrder, verifySlipAndCredit, sendPaymentQr

  notifications/
    approval.ts                 ← (content approval notifications via LINE push)

  webhook/
    index.ts                    ← POST handler + event dispatcher
    db.ts                       ← getOrCreateConversation()
    types.ts                    ← LineMessage, FlexMessage, AgentRow, LinkedUser, Sender, ...
    events/
      follow.ts                 ← handleFollowEvent
      message.ts                ← handleMessageEvent  ← PRIMARY FILE — most capabilities here
      postback.ts               ← handlePostbackEvent
    flex/
      index.ts                  ← re-exports
      reply.ts                  ← buildReplyMessages(), buildFlexReplyBubble()
      welcome.ts                ← buildWelcomeFlex()
    rich-menu/
      builder.ts                ← createRichMenu(), applyRichMenuToChannel()
    utils/
      markdown.ts               ← stripMarkdown()
      quick-reply.ts            ← buildQuickReplyItem()
      text.ts                   ← extractTextContent()

  components/
    rich-menu-editor.tsx        ← Visual rich menu builder UI

db/schema/line-oa.ts            ← All LINE OA Drizzle table definitions
```

---

## 3. Database Schema Reference

All tables live in `db/schema/line-oa.ts`.

### `line_oa_channel`
One row per connected LINE Official Account.

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | Internal UUID |
| `userId` | text FK → user | Owner (Vaja app user) |
| `lineChannelId` | text | LINE platform channel ID |
| `channelAccessToken` | text | Long-lived token for Messaging API |
| `channelSecret` | text | Used for signature verification |
| `name` | text | Display name shown in control room |
| `agentId` | text FK → agent | Default AI agent for this channel |
| `status` | text | `active` \| `inactive` — inactive channels are silently ignored |

### `line_conversation`
Persists the AI conversation thread per (channel, LINE user). Maps to `chatThread`.

| Column | Type | Notes |
|--------|------|-------|
| `channelId` | text FK | |
| `lineUserId` | text | LINE user ID (`U` prefix) |
| `threadId` | text FK → chatThread | Drizzle chat messages stored here |

### `line_rich_menu`
Rich menu configurations (JSON areas + image URL).

### `line_user_menu`
Per-user active rich menu override. Set by `switch_menu:` postback.

### `line_rich_menu_template`
Admin-defined template presets for quick menu creation.

### `line_broadcast`
Broadcast message definitions.

| Column | Type | Notes |
|--------|------|-------|
| `status` | text | `draft` \| `sent` \| `failed` |
| `messageText` | text | Plain text content |
| `sentAt` | timestamp | Populated when broadcast fires |

### `line_account_link_token`
One-time tokens generated from the web dashboard for LINE account linking.

| Column | Type | Notes |
|--------|------|-------|
| `token` | text UNIQUE | 8-char alphanumeric (avoids 0/O/I/1) |
| `expiresAt` | timestamp | 15 minutes from creation |
| `usedAt` | timestamp | Null until consumed |

### `line_account_link`
Junction: LINE user ↔ Vaja app user on a specific channel.

| Column | Type | Notes |
|--------|------|-------|
| `lineUserId` | text | |
| `userId` | text FK → user | App user |
| `channelId` | text FK | |
| `displayName` | text | From LINE profile |
| `pictureUrl` | text | From LINE profile |

Unique constraint: `(channelId, lineUserId)` — one app account per LINE user per channel.

### `line_user_agent_session`
Per-user active agent override. Cleared by `switch_agent:default`.

| Column | Type | Notes |
|--------|------|-------|
| `channelId + lineUserId` | unique | Upserted on switch |
| `activeAgentId` | text FK → agent \| null | null = channel default |

### `line_channel_daily_stat`
Aggregated daily metrics per channel.

| Column | Notes |
|--------|-------|
| `date` | `YYYY-MM-DD` string |
| `messageCount` | Total inbound messages |
| `uniqueUsers` | Distinct LINE user IDs |
| `toolCallCount` | Agent tool calls fired |
| `imagesSent` | Images sent by the bot |

### `line_channel_daily_user`
Deduplication table for `uniqueUsers` counting. One row per (channel, date, lineUserId).

### `line_payment_order`
PromptPay top-up orders initiated by LINE users.

| Column | Type | Notes |
|--------|------|-------|
| `userId` | text FK → user | App user (must be linked) |
| `lineUserId` | text | Who initiated |
| `packageId` | text | References `CREDIT_PACKAGES[].id` |
| `amountThb` | numeric(10,2) | Thai Baht amount |
| `credits` | integer | Credits to grant on success |
| `status` | text | `pending` \| `verifying` \| `completed` \| `failed` \| `expired` |
| `slipRef` | text | slipok.app `transRef` — used for duplicate detection |
| `senderName` | text | From slipok response |
| `expiresAt` | timestamp | 30 minutes from creation |

---

## 4. Webhook Pipeline (Deep Dive)

### Entry point: `app/api/line/[channelId]/route.ts`

This file simply re-exports the `POST` handler from `features/line-oa/webhook/index.ts`. The `maxDuration = 30` is set here (Vercel function timeout).

### Dispatcher: `features/line-oa/webhook/index.ts`

Order of operations per request:
1. Read raw body as text (must not be consumed before signature check)
2. Look up `lineOaChannel` by `channelId` param — return 200 silently if not found or inactive
3. Verify `x-line-signature` HMAC-SHA256 — return 401 if invalid
4. Parse JSON events array
5. Load default agent config + brand logo
6. Init `MessagingApiClient` with `channelAccessToken`
7. Loop over events — each in its own try/catch to prevent one bad event from killing the batch

### The 30-Second Rule

LINE expects a 200 response within 30 seconds. For operations that take longer:

```
Pattern: Reply synchronously → fire-and-forget long op via pushMessage

// DO THIS for long ops
await lineClient.replyMessage({ ... });          // uses the reply token (one-time)
void longOperation(lineClient, lineUserId, ...); // no await — delivers via pushMessage
```

**Reply token is one-time and expires in ~60 seconds.** Use `replyMessage` for the acknowledgement, then `pushMessage` for async delivery.

---

## 5. Message Handler — Full Capability Map

`features/line-oa/webhook/events/message.ts` handles all inbound messages. Sections are processed in this order:

```
msgType check ─► not text/image/audio/video → return early

① Link command        /link XXXXXXXX                → consumeLinkToken
① Register command    สมัครสมาชิก / สมัคร / /register  → registerLineUser
① Topup command       เติมเครดิต / เติมเงิน / /topup   → formatPackageMenu
① Package selection   1 / 2 / 3 / 4                → createPaymentOrder → sendPaymentQr (fire-and-forget)

② Loading animation   showLoadingAnimation (fire-and-forget)

③ image input         ③a: pending order? → verifySlipAndCredit
                       ③b: no/other error → vision model → text reply

④ audio input         transcribeLineAudio (Gemini) → generateText → replyMessage
                       + sendVoiceReply (Gemini TTS → MP3 → R2 → pushMessage, fire-and-forget)

⑤ video input         getMessageContentPreview → vision model → replyMessage

⑥ text input
  ⑥a image-gen        wantsImageGeneration? → generateImage → R2 → replyMessage
  ⑥b video-gen        wantsVideoGeneration? → replyMessage → generateAndDeliverVideo (fire-and-forget)
  ⑥c standard         generateText (with optional agent tools) → buildReplyMessages → replyMessage
```

### Flex vs Plain Text

`buildReplyMessages()` in `flex/reply.ts` automatically decides:
- **Flex bubble**: if text contains `• ` bullets (≥ `FLEX_BULLET_THRESHOLD`)
- **Plain text**: otherwise

Always call `stripMarkdown(rawText)` before passing to `buildReplyMessages()`.

### Quick Replies

After each AI response, `generateFollowUpSuggestions()` produces 3 quick-reply chips. These are passed to `buildReplyMessages()` as the `quickReply` parameter. The chips appear as tappable buttons below the message bubble.

---

## 6. Multimodal I/O

### Image Input (user sends photo)

```typescript
// Download from LINE Content API
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });
const stream = await blobClient.getMessageContent(messageId);
const buffer = await streamToBuffer(stream);
const base64 = buffer.toString('base64');

// Send to vision model
const { text } = await generateText({
  model: resolveVisionModel(modelId) as any,
  messages: [{ role: 'user', content: [{ type: 'image', image: base64, mediaType: 'image/jpeg' }] }],
});
```

**`resolveVisionModel(modelId)`** falls back to `chatModel` (Gemini) if the agent's model doesn't support vision.
Vision-capable prefixes: `google/`, `openai/gpt-5`, `openai/gpt-4`, `anthropic/claude`.

### Audio Input (user sends voice note)

```typescript
// transcribeLineAudio() in message.ts:
// 1. Download m4a via getMessageContent()
// 2. Send to Gemini gemini-2.5-flash-lite as inlineData audio/m4a
// 3. Returns transcribed text in the original language (Thai preserved)
const transcript = await transcribeLineAudio(messageId, channelAccessToken);
```

After replying with text, voice reply is fire-and-forget:
```typescript
void sendVoiceReply(lineClient, lineUserId, replyText);
// Pipeline: Gemini TTS (gemini-2.5-flash-preview-tts) → PCM 24kHz → lamejs MP3 → R2 → pushMessage
```

**TTS voice name:** `Aoede` (supports Thai). Change in `sendVoiceReply()`.
**MP3 encoding:** lamejs `Mp3Encoder(1, 24000, 128)`, 1152-sample frames.
**LINE audio duration:** Calculated from PCM byte length: `(bytes / (24000 * 2)) * 1000` ms.

### Video Input (user sends video)

Use `getMessageContentPreview()` — returns a small JPEG thumbnail, not the full video file (up to 200 MB). The preview is analysed by the vision model.

```typescript
// DO THIS — lightweight preview frame
const stream = await blobClient.getMessageContentPreview(messageId);

// DON'T DO THIS for video — too large, may timeout
const stream = await blobClient.getMessageContent(messageId);
```

### Image Output (bot generates image)

```typescript
const result = await generateImage({ model: LINE_IMAGE_MODEL as any, prompt: userText });
const { url } = await uploadPublicObject({ key, body: Buffer.from(result.image.base64, 'base64'), contentType: result.image.mediaType });
await lineClient.replyMessage({ replyToken, messages: [{ type: 'image', originalContentUrl: url, previewImageUrl: url }] });
```

Current image model: `openai/gpt-image-1.5` (constant `LINE_IMAGE_MODEL` in `message.ts`).

### Video Output (bot generates video)

Uses KIE Veo via fire-and-forget pattern. Polling loop: 48 × 5s = 4 min max.

```typescript
// Immediate acknowledgement
await lineClient.replyMessage({ replyToken, messages: [{ type: 'text', text: 'กำลังสร้างวิดีโอ...' }] });

// Background: generate + poll + push
void generateAndDeliverVideo(lineClient, lineUserId, prompt);
```

`generateAndDeliverVideo()` also generates a thumbnail image in parallel via the same image model, used as `previewImageUrl` in the LINE video message.

---

## 7. Account Linking & LINE-Native Registration

### Method A: Token-Based Linking (Web → LINE)

Use when a user already has a Vaja web account and wants to link it to LINE.

```
Web dashboard → POST /api/line-oa/[id]/link-tokens
    → generateLinkToken(channelId, userId)
    → returns { token, expiresAt }  (8-char code, 15 min TTL)

User types `/link XXXXXXXX` in LINE
    → webhook → consumeLinkToken(token, lineUserId, channelId, lineClient)
    → creates lineAccountLink row
    → fetches LINE profile (displayName, pictureUrl)
```

**Token alphabet:** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no 0/O/I/1 to avoid visual confusion.

### Method B: LINE-Native Registration (LINE-only)

Use when a user has no web account. They register entirely from LINE.

```
User types: สมัครสมาชิก / สมัคร / /register / register
    → registerLineUser(lineUserId, channelId, lineClient)
    → creates user row (emailVerified=true, synthetic email line_{userId}@line.internal)
    → creates account row (providerId='line', accountId=lineUserId)
    → creates lineAccountLink row
    → grants SIGNUP_BONUS_CREDITS
    → if channel.memberRichMenuLineId is set:
        → lineClient.linkRichMenuIdToUser(lineUserId, memberRichMenuLineId)  ← fire-and-forget
    → returns { ok, isNew, name }
```

**Synthetic email** (`line_{lineUserId}@line.internal`) satisfies the `UNIQUE NOT NULL` email constraint without being a real email. Never used for login — LINE identity IS the authentication.

**Idempotent:** `registerLineUser` returns `{ ok: true, isNew: false }` if already registered.

**Duplicate email error** means the LINE user already registered on another channel — handled gracefully.

### Member Rich Menu (auto-swap on registration)

`lineOaChannel.memberRichMenuLineId` (LINE platform menu ID, not internal UUID) defines the menu to assign to a user immediately after they register.

**Typical use case — 4-button layout (3 top + 1 wide bottom):**

| Menu | Wide bottom button | Who sees it |
|------|--------------------|-------------|
| Default (channel default) | สมัครสมาชิก | All new visitors |
| Member menu (`memberRichMenuLineId`) | เติมเครดิต | After registration |

**Setting the member menu:** In the LINE OA control room → Rich Menus → deploy a menu → click **"Set as member menu"** button. Clicking again unsets it (sets to `null`).

**Implementation notes:**
- `lineOaChannel.memberRichMenuLineId` stores the LINE platform ID (the `lineMenuId` column on `line_rich_menu`), not our internal UUID
- The `linkRichMenuIdToUser` call is fire-and-forget — a failure does not block the registration reply
- A menu must be deployed to LINE first (`lineMenuId` populated) before it can be set as member menu
- The UI button is disabled until the menu is deployed

### `lineAccountLink` Usage

Once linked, the webhook loads `linkedUser` in parallel with the agent session:
```typescript
const [linkRows, sessionRows] = await Promise.all([
  db.select({ userId, displayName }).from(lineAccountLink).where(...),
  db.select({ activeAgentId }).from(lineUserAgentSession).where(...),
]);
const linkedUser = linkRows[0] ?? undefined;
```

`linkedUser` is passed to `handleMessageEvent`. When present:
- Memory context is loaded (`getUserMemoryContext`)
- Memory is extracted after each exchange (`extractAndStoreMemory`)
- System prompt is personalised with the user's name

---

## 8. PromptPay Payment Flow

### Overview

```
User: เติมเครดิต
Bot: [package menu text]

User: 2
Bot: กำลังสร้าง QR Code...
     (fire-and-forget: upload QR to R2 → pushMessage image + instructions)

User: [sends slip image]
    → verifySlipAndCredit()
    → slipok.app API v3
    → addCredits()
    → Bot: ✅ ชำระเงินสำเร็จ!
```

### Files

| File | Purpose |
|------|---------|
| `features/line-oa/payment/packages.ts` | `CREDIT_PACKAGES[]`, `formatPackageMenu()`, `getPackageById()` |
| `features/line-oa/payment/service.ts` | `createPaymentOrder()`, `verifySlipAndCredit()`, `uploadQrToR2()`, `sendPaymentQr()` |

### Credit Packages (current)

| ID | Amount | Credits | Discount |
|----|--------|---------|----------|
| `pkg_100` | ฿100 | 500 | — |
| `pkg_300` | ฿300 | 1,800 | 20% |
| `pkg_500` | ฿500 | 3,500 | 30% |
| `pkg_1000` | ฿1,000 | 8,000 | 38% |

To change packages: edit `CREDIT_PACKAGES` array in `packages.ts`. No DB migration needed.

### Slip Verification Flow

```typescript
// createPaymentOrder() pipeline:
// 1. Verify lineAccountLink exists (user must be registered)
// 2. Insert linePaymentOrder (status='pending', expiresAt=now+30min)
// 3. generatePayload(PROMPTPAY_ID, { amount }) → PromptPay QR string
// 4. QRCode.toDataURL() → base64 PNG
// 5. Return { orderId, qrDataUrl, pkg }

// verifySlipAndCredit() pipeline:
// 1. Find pending order for this (channelId, lineUserId) not expired
// 2. Mark order as 'verifying' (prevents duplicate processing)
// 3. POST to slipok.app /api/line/apikey/v3 with multipart image
// 4. Check slipData.success + transRef for deduplication
// 5. Mark order 'completed', store slipRef + senderName
// 6. addCredits({ userId, amount: credits, type: 'topup' })
```

**Slip detection in image handler:** Before doing vision analysis on any image, the handler calls `verifySlipAndCredit()`. If it returns `ok: true` → credits added, return early. If error contains "ไม่พบคำสั่งซื้อ" → no pending order → fall through to normal vision analysis. Any other error → tell the user the slip failed.

### slipok.app API

- Endpoint: `https://api.slipok.com/api/line/apikey/v3`
- Auth header: `x-authorization: <SLIPOK_API_KEY>`
- Body: `multipart/form-data` with `files` (image blob), `log=true`, `amount` (Thai Baht integer)
- Response key fields: `success`, `data.transRef`, `data.amount`, `data.sender.displayName`

### Required Env Vars

```bash
PROMPTPAY_ID=0812345678      # Phone number or national ID registered with PromptPay
SLIPOK_API_KEY=xxxxx         # From slipok.app dashboard
```

---

## 9. Rich Menu System

Rich menus are visual button grids shown at the bottom of the LINE chat.

### Key Functions

```typescript
// features/line-oa/webhook/rich-menu/builder.ts
createRichMenu(channelId, userId, menuConfig)      // creates menu on LINE platform + saves to DB
applyRichMenuToChannel(channelId, userId)           // sets default menu for all users
setUserRichMenu(lineUserId, lineMenuId, channelId, channelAccessToken)  // per-user override (postback)
```

### Postback Trigger

When a rich menu button is tapped with `data: "switch_menu:<lineMenuId>"`:
```typescript
// postback.ts
await setUserRichMenu(lineUserId, lineMenuId, channelId, channelAccessToken);
```

This stores the choice in `line_user_menu` so the user's menu persists across sessions.

### Agent Switching via Rich Menu

A rich menu button can use `data: "switch_agent:<agentId>"` to switch the user to a specialist AI. The session is stored in `line_user_agent_session`. This allows building "department" flows:
- Button "Sales" → `switch_agent:sales-agent-id`
- Button "Support" → `switch_agent:support-agent-id`
- Button "Main Menu" → `switch_agent:default`

### Skill Activation via Rich Menu Buttons

Buttons with `type: "message"` send text that flows through the normal message handler, which means they can activate skills just like typed messages. Use this for skill-specific buttons:

```
Button text "ถามเรื่องโรคพืชและแมลงศัตรูพืช"  →  model-scores → pest-disease-consult activates
Button text "เช็คสภาพอากาศและความเสี่ยงฟาร์ม"  →  model-scores → weather-farm-risk activates
Button text "บันทึกกิจกรรมฟาร์มวันนี้"         →  model-scores → farm-record-keeper activates
```

This keeps all skills on one agent — no `switch_agent` needed.

### Template System

Rich menus can be saved as reusable templates via the "Save as template" (bookmark) icon in the control room. Templates store `name`, `chatBarText`, and all area definitions. Apply a template to any channel via the "Select template" dropdown in the editor — all fields pre-fill in one click.

**Bug fix (2026-04-07):** The rich menu editor showed blank fields when editing an existing menu. Root cause: React `useState` only initializes once on mount. Fixed by adding `key={editTarget?.id ?? 'new'}` to `RichMenuEditor` in `rich-menu-panel.tsx` — forces remount on each open.

---

## 10. Broadcast & Narrowcast

`features/line-oa/broadcast/service.ts`

### Functions

```typescript
listBroadcasts(channelId, userId)          // list all, verifies ownership
createBroadcast(channelId, userId, input)  // creates draft
updateBroadcast(broadcastId, userId, patch)
deleteBroadcast(broadcastId, userId)
sendBroadcast(broadcastId, userId)         // sends via multicast to all lineAccountLink users
```

### Sending Logic

`sendBroadcast()` queries all `lineAccountLink` rows for the channel and uses `lineClient.multicast()` in batches of 500 (LINE API limit).

### Push to Specific User

For app-event-triggered messages (e.g., "your result is ready"):
```typescript
// features/line-oa/link/service.ts
pushToLinkedUser(linkId, userId, messageText)       // single linked user
pushToAllLinkedUsers(channelId, messageText, token) // all users on channel
```

---

## 11. Analytics Pipeline

`features/line-oa/analytics.ts`

### `recordMessageEvent(channelId, lineUserId, options?)`

Called at the end of every handled message event. Updates two tables atomically:
1. `line_channel_daily_stat` — upserts daily aggregate (messageCount, toolCallCount, imagesSent)
2. `line_channel_daily_user` — inserts unique user row (for uniqueUsers count) — `ON CONFLICT DO NOTHING`

Always fire-and-forget:
```typescript
recordMessageEvent(channel.id, lineUserId, { imagesSent: 1 }).catch(() => {});
```

### `getChannelStats(channelId, days)`

Returns the last N days of `DailyStatRow[]` for the analytics dashboard.

### AI Metrics Tools

`features/line-oa/metrics-tools.ts` wraps analytics queries as AI SDK tools so an agent with `enabledTools: ['line_analytics']` can answer questions like "how many messages did we get this week?" directly in LINE chat.

---

## 12. Agent Selection per User

The dispatcher resolves a 2-level agent cascade for each message:

```
Level 1: lineOaChannel.agentId                   — channel default
Level 2: lineUserAgentSession.activeAgentId       — user override (set via rich menu / postback)
```

If Level 2 exists and differs from Level 1, the webhook loads the user-chosen agent and uses its `systemPrompt`, `modelId`, `name`, and `enabledTools`.

After resolving the effective agent, the Skills Engine runs (see section 13) before `handleMessageEvent` is called. This means skill context is always agent-specific — switching agents also switches their skill set.

This is how "department routing" works: the same LINE OA can serve different AI agents (each with their own skills) to different users simultaneously.

---

## 13. Skills Engine in LINE OA

Skills attached to an agent are now fully active in LINE conversations, matching the behaviour of the web chat (`app/api/chat/route.ts`).

### Where it runs

`features/line-oa/webhook/index.ts` — after the effective agent is resolved, before calling `handleMessageEvent`.

### What it does

```typescript
// 1. Load all skills attached to the agent
//    Reads attachment-table rows only
const agentSkillRows = await getSkillsForAgent(agentId);

// 2. Rule-based triggers: always / slash command / keyword
const ruleTriggered = detectTriggeredSkills(agentSkillRows, userText);

// 3. Model-scored discovery: top-2 skills by relevance to the message
const modelDiscovered = selectModelDiscoveredSkills(agentSkillRows, userText);

// 4. Deduplicate
const triggeredSkills = [...new Map([...ruleTriggered, ...modelDiscovered].map(s => [s.id, s])).values()];

// 5. Tier 1 — catalog injected into systemPrompt
effectiveSystemPrompt += buildAvailableSkillsCatalog(agentSkillRows);

// 6. Tier 2 — full promptFragment for triggered skills
effectiveSystemPrompt += '\n\n<active_skills>\n' + triggeredSkills.map(...).join('\n\n') + '\n</active_skills>';
```

### Three-tier injection (current state)

| Tier | What | Status |
|------|------|--------|
| Tier 1 | `<available_skills>` — names + descriptions of model-discoverable skills | ✅ Implemented |
| Tier 2 | `<active_skills>` — full `promptFragment` of triggered skills | ✅ Implemented |
| Tier 3 | `<skill_resources>` — relevant reference/asset files bundled in skill package | Planned (Phase 3 of skills roadmap) |

Tier 3 will be added once `features/skills/server/resources.ts` exists (per `docs/agent-skill-implementation-guide.md` Phase 3).

### Trigger types

| Type | Activates when |
|------|---------------|
| `always` | Every message — the skill is permanently active |
| `slash` | User message starts with `/command-name` |
| `keyword` | User message contains the trigger keyword (case-insensitive) |
| `model` | LLM-scored; top 2 by relevance score auto-activated |

### Legacy compatibility

`getSkillsForAgent()` now reads only `agent_skill_attachment` rows. `agent.skillIds` is no longer used by the LINE webhook runtime.

### Skill-enabled tools in LINE

Triggered skills may declare `enabledTools` (tool IDs they unlock). These are **not yet merged** into the LINE tool set — the LINE webhook builds tools from `agentRow.enabledTools` only. This is a known gap; see section 20.

---

## 14. Adding a New Text Command

Text commands are handled at the top of `handleMessageEvent()` before the loading spinner and conversation setup. Add new commands in the `if (msgType === 'text')` block:

```typescript
// In features/line-oa/webhook/events/message.ts
// Inside the if (msgType === 'text') block, add BEFORE the loading animation section:

const isMyCommand = userText === 'ทริกเกอร์ไทย' || userText.toLowerCase() === '/mycommand';
if (isMyCommand) {
  // Do work...
  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'ผลลัพธ์...' }],
  });
  return; // ALWAYS return early — prevents falling through to AI handler
}
```

**Rules:**
1. Import service functions at the top of the file
2. Always `return` after handling — never fall through
3. Use `replyMessage` for instant reply (uses the one-time reply token)
4. Use `pushMessage` for anything sent asynchronously after the reply

---

## 15. Adding a New Postback Action

Postback data is a plain string. Use a descriptive prefix pattern:

```typescript
// In features/line-oa/webhook/events/postback.ts
if (data.startsWith('my_action:')) {
  const payload = data.slice('my_action:'.length);
  // Do work...
  if (event.replyToken) {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'Done!' }],
    });
  }
  return;
}
```

Register the postback data on a button in the rich menu editor or in a Flex message:
```json
{ "type": "postback", "data": "my_action:some-id" }
```

---

## 16. Adding a New LINE Agent Tool

LINE agent tools are AI SDK tool objects used by `generateText()` in the standard text path (⑥c).

### Pattern

```typescript
// features/line-oa/my-feature/line-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

export function buildMyFeatureLineTools(userId: string | null) {
  return {
    my_tool_name: tool({
      description: 'What this tool does and when to use it.',
      parameters: z.object({ param: z.string() }),
      execute: async ({ param }) => {
        if (!userId) return { error: 'Not linked' };
        return myService.doSomething(userId, param);
      },
    }),
  };
}
```

### Registration in message.ts

```typescript
// In ⑥c standard text block
const isMyAgent = enabledTools.includes('my_feature');
const myTools = isMyAgent ? buildMyFeatureLineTools(linkedUser?.userId ?? null) : undefined;

const mergedTools = (contentTools || plannerTools || metricsTools || myTools)
  ? { ...contentTools, ...plannerTools, ...metricsTools, ...myTools }
  : undefined;
```

### Enabling the Tool

Set `enabledTools: ['my_feature']` on the agent via the web control room. The dispatcher loads this from `agentRow.enabledTools`.

---

## 17. Common Mistakes & Gotchas

### 1. Double-consuming the reply token

```typescript
// WRONG — two replyMessage calls with same token
await lineClient.replyMessage({ replyToken, messages: [...] });
await lineClient.replyMessage({ replyToken, messages: [...] }); // 400 error

// RIGHT — first message via reply, rest via push
await lineClient.replyMessage({ replyToken, messages: [acknowledgement] });
await lineClient.pushMessage({ to: lineUserId, messages: [follow_up] });
```

### 2. Blocking the webhook with long sync work

```typescript
// WRONG — times out after 30s
await generateVideo(...); // takes minutes
await lineClient.replyMessage(...);

// RIGHT
await lineClient.replyMessage({ replyToken, messages: [{ type: 'text', text: 'กำลังสร้าง...' }] });
void generateAndDeliverVideo(lineClient, lineUserId, prompt); // fire-and-forget
```

### 3. Using getMessageContent for video

```typescript
// WRONG — may download a 200 MB file
const stream = await blobClient.getMessageContent(videoMessageId);

// RIGHT — tiny JPEG preview frame
const stream = await blobClient.getMessageContentPreview(videoMessageId);
```

### 4. Missing return after command handler

```typescript
// WRONG — falls through to AI chat
if (isRegisterCommand) {
  await registerLineUser(...);
  await lineClient.replyMessage(...);
  // missing return!
}
// continues to ② loading animation → creates unnecessary conversation

// RIGHT
if (isRegisterCommand) {
  ...
  return; // ALWAYS return
}
```

### 5. Forgetting ownership verification in services

Every service function that reads or writes data for a channel must verify that the requesting `userId` owns that channel. Pattern:
```typescript
const channelRows = await db.select({ id: lineOaChannel.id }).from(lineOaChannel)
  .where(and(eq(lineOaChannel.id, channelId), eq(lineOaChannel.userId, userId))).limit(1);
if (!channelRows[0]) throw new Error('Channel not found');
```

### 6. Returning non-200 for non-critical events

LINE will retry the webhook if it gets a non-200 response. Always return 200 for LINE requests, even for unknown event types or channels that can't be processed:
```typescript
if (channelRows.length === 0 || channelRows[0]!.status !== 'active') {
  return new Response('OK', { status: 200 }); // Silent 200, not 404
}
```

### 7. Markdown in LINE messages

LINE does not render markdown. Always strip before sending:
```typescript
const reply = stripMarkdown(rawAiText);
```
The system prompt already instructs the AI to avoid markdown, but AI models sometimes ignore this. Always call `stripMarkdown()` as a safety net.

### 8. Payment: slip image sent with no pending order

When `verifySlipAndCredit()` returns `ok: false` with error text containing `ไม่พบคำสั่งซื้อ`, it means no pending order — treat as a normal image and fall through to vision analysis. All other `ok: false` errors should be reported to the user.

---

## 18. Environment Variables

```bash
# LINE Messaging API — per-channel, stored in DB (not env vars)
# channelAccessToken  — stored in line_oa_channel.channelAccessToken
# channelSecret       — stored in line_oa_channel.channelSecret

# Multimodal I/O
GEMINI_API_KEY=              # Gemini transcription (audio) + TTS + vision fallback
KIE_API_KEY=                 # KIE Veo video generation

# Payment
PROMPTPAY_ID=0812345678      # PromptPay phone or national ID (your receiving account)
SLIPOK_API_KEY=              # From slipok.app dashboard → API Keys

# Object storage (for QR codes, audio, images)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=          # Public CDN URL for the R2 bucket
```

---

## 19. LINE API Limits Reference

| Limit | Value | Notes |
|-------|-------|-------|
| Reply token TTL | ~60 seconds | Use within the webhook call |
| Reply token uses | 1 | One-time use only |
| `replyMessage` messages per call | 5 | Max 5 message objects per reply |
| `pushMessage` messages per call | 5 | Same limit |
| `multicast` recipients per call | 500 | Batch larger lists |
| Audio message max duration | No hard limit (practical: <5 min) | LINE may reject very large files |
| Image message file size | 10 MB | Both `originalContentUrl` and `previewImageUrl` must be HTTPS |
| Video message file size | 200 MB | `originalContentUrl` must be HTTPS |
| Rich menu image size | 2500×1686 or 2500×843 | JPEG only, max 1 MB |
| `showLoadingAnimation` duration | 5–60 seconds (multiples of 5) | Auto-dismissed on reply |
| Webhook timeout | 30 seconds | After this, LINE marks delivery as failed and may retry |
| Webhook retries | 3 retries | ~2 min intervals — make handlers idempotent |

### Idempotency Note

Because LINE retries failed webhooks, payment and registration handlers must be idempotent:
- `registerLineUser` — checks existing `lineAccountLink` before inserting
- `consumeLinkToken` — checks `usedAt IS NULL` before consuming
- `verifySlipAndCredit` — deduplicates by `transRef` before crediting

---

## 20. Improvement Roadmap

This section tracks known gaps and planned enhancements. Items are ordered by impact.

### Priority 1 — High Impact, Relatively Small Scope ✅ DONE (2026-04-06)

#### ~~Skill-enabled tools in LINE~~ ✅

`resolveSkillRuntimeContext` returns `skillToolIds`. In `webhook/index.ts` these are now captured and passed as the `skillToolIds` parameter to `handleMessageEvent`. Inside `handleMessageEvent` (`events/message.ts` line 816) `enabledTools` is now merged: `[...new Set([...agentRow.enabledTools, ...skillToolIds])]`.

#### ~~Tier 3 skill resources~~ ✅

Already implemented. `resolveSkillRuntimeContext` calls `getResolvedSkillResourcesForPrompt` (in `features/skills/server/resources.ts`) and `webhook/index.ts` appends `skillRuntime.skillResourcesBlock` to `effectiveSystemPrompt`.

#### ~~Per-user rich menus not activated~~ ✅

Fixed in `webhook/index.ts`. The message handler now queries `lineUserMenu` and `lineRichMenu` (default menu) in the opening parallel block. If a user has a stored `lineMenuId` that differs from the channel default, `lineClient.linkRichMenuIdToUser()` is called fire-and-forget to restore the preference before generating a reply.

---

### Priority 2 — Enables New Use Cases ✅ DONE (2026-04-06)

#### ~~Narrowcast & audience targeting~~ ✅

Added `lineAudience` and `lineAudienceUser` tables (`db/schema/line-oa.ts`, migration `0041`). Service functions `createAudience()` and `sendNarrowcast()` in `features/line-oa/broadcast/service.ts` use `manageAudience.ManageAudienceClient` to upload user lists to LINE and `MessagingApiClient.narrowcast()` to send. Routes: `POST /api/line-oa/[id]/audience` and `POST /api/line-oa/[id]/narrowcast/send`.

#### ~~Message statistics per broadcast~~ ✅

Added `customAggregationUnit: text` to `lineBroadcast`. `sendBroadcast()` now derives the unit from broadcastId (`replace(/-/g,'').slice(0,30)`), stores it before sending, and passes `customAggregationUnits` to LINE. New `getBroadcastStats()` calls LINE insight aggregation API (`/v2/bot/insight/message/event/aggregation`) using stored unit + `sentAt` date. Route: `GET /api/line-oa/[id]/broadcasts/[broadcastId]/stats`.

#### ~~API retry on transient failures~~ ✅

Added `withRetry<T>()` helper in `broadcast/service.ts` — 3 retries with 1s/2s/4s exponential backoff on 429 or 5xx. Wraps `lineClient.broadcast()` in `sendBroadcast()` and `lineClient.narrowcast()` in `sendNarrowcast()`. Added `"partial"` to `BroadcastStatus` type for future batch-level failure tracking.

---

### Priority 3 — UX & Revenue ✅ Partially done (2026-04-06)

#### ~~Sticker message support~~ ✅

`features/line-oa/utils/stickers.ts` — `WELCOME_STICKERS`, `FRIENDLY_STICKERS`, `pickRandom()`, `shouldAddFriendlySticker()`.
- `follow.ts` — welcome reply now includes a random Brown & Cony greeting sticker after the Flex bubble.
- `message.ts` — short conclusive AI replies (≤80 chars, no question mark, no error) get a friendly sticker ~20% of the time.

#### ~~Smoother PromptPay UX~~ ✅ (vision-assisted auto-slip detection)

The old flow required: type "เติมเครดิต" → pick package number → send slip. Now users can just **send the slip directly**.

In `message.ts` image handler: when no pending order exists, `detectPaymentSlip()` uses `gemini-2.5-flash-lite` with JSON mode to check if the image is a Thai PromptPay slip and extract the amount. If the amount matches a package (±฿1), an order is auto-created and `verifySlipAndCredit` is called immediately. On success, credits are added in one step. If the amount doesn't match any package, a helpful message lists the available tiers.

#### LINE Pay integration — DEFERRED (future plan)

LINE Pay requires a registered Thai legal entity and a LINE Partner approval process that takes weeks to months. Not suitable for early-stage / public test phase.

**Future plan:** Once Vaja has a legal entity and has run public tests long enough to justify it, integrate LINE Pay for one-tap payment UX. Required: `LINE_PAY_CHANNEL_ID`, `LINE_PAY_CHANNEL_SECRET` env vars, `confirmPayment` webhook handler, and LINE Pay API client.

**Alternative considered:** Omise/Stripe payment link sent via LINE Flex Message button — lower friction than LINE Pay approval, usable without LINE Partner status. Implement via `uri` action in a Flex bubble pointing to `/checkout?package=...`.

#### Subscription billing — DEFERRED (future plan)

Not needed until public test phase completes and recurring users are established. Premature infrastructure for current stage.

**Future plan:** `subscriptionPlan` + `userSubscription` tables, recurring charge via Stripe/Omise on the web dashboard, credit balance reflected in LINE. Cron job (or Stripe webhook) to top up credits on renewal.

---

### Priority 4 — Platform Expansion ✅ DONE (2026-04-06)

#### ~~Group chat support~~ ✅

Added `groupId text nullable` to `lineConversation` (migration `0042`). `WebhookEvent.source` now typed with `groupId?`. In `webhook/index.ts`, `event.source.type === 'group'` is detected; `groupId` is used as the conversation key (stored in `lineConversation.lineUserId` for index compatibility, mirrored in `groupId` column). Agent session and rich menu lookups use the group-level key; account link lookup uses the individual sender's `lineUserId`. System prompt in `message.ts` appends a group-chat context note and identifies the individual sender.

#### ~~Beacon / location triggers~~ ✅

Added `lineBeaconDevice` table (migration `0042`) with `hwid`, `name`, `description`, `enterMessage`. New handler `features/line-oa/webhook/events/beacon.ts` handles `enter` and `banner.click` events — looks up the device by `hwid`, pushes the configured `enterMessage` (or a default greeting) via `pushMessage`. `webhook/index.ts` routes `event.type === 'beacon'` to the handler.

#### ~~User profile sync~~ ✅

`features/line-oa/link/profile-sync.ts` — `maybeSyncUserProfile()` uses an in-process `Map` as a 24h TTL cache (no schema change needed; resets on cold start which is fine for serverless). On each message from a linked user, it checks the cache; if stale, calls `GET /v2/bot/profile/{userId}` and upserts `displayName` and `pictureUrl` in `lineAccountLink`. Wired in `webhook/index.ts` as fire-and-forget.

---

### Implementation status summary

| Feature | Status |
|---------|--------|
| Webhook — text, image, audio, video input | ✅ Complete |
| Image / video / audio output | ✅ Complete |
| Account linking (token + LINE-native registration) | ✅ Complete |
| PromptPay payment + slip verification | ✅ Complete |
| Rich menu create/deploy | ✅ Complete |
| Agent switching per user (rich menu postback) | ✅ Complete |
| Broadcast to all linked users | ✅ Complete |
| Daily analytics aggregation | ✅ Complete |
| Content approval postback | ✅ Complete |
| Skills Engine — Tier 1 + Tier 2 + Tier 3 injection | ✅ Complete (2026-04-06) |
| Skill-enabled tools merge in LINE | ✅ Complete (2026-04-06) |
| Per-user rich menu restoration | ✅ Complete (2026-04-06) |
| Narrowcast + audience segments | ✅ Complete (2026-04-06) |
| Broadcast message statistics | ✅ Complete (2026-04-06) |
| API retry on broadcast failures | ✅ Complete (2026-04-06) |
| Sticker messages | ✅ Complete (2026-04-06) |
| Vision-assisted PromptPay slip detection | ✅ Complete (2026-04-06) |
| Group chat support | ✅ Complete (2026-04-06) |
| Beacon / location triggers | ✅ Complete (2026-04-06) |
| User profile sync | ✅ Complete (2026-04-06) |
| LINE Pay | ⏸ Deferred — requires LINE Partner approval |
| Subscription billing | ⏸ Deferred — post public-test phase |

---

*Last updated: 2026-04-06. All Priority 1–4 items implemented. Remaining deferred: LINE Pay (requires LINE Partner approval) and subscription billing (post public-test phase). Covers webhook, multimodal I/O, account linking, payments, Skills Engine (Tier 1+2+3), narrowcast, group chat, beacons, and profile sync.*
