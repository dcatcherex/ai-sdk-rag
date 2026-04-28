# Vaja: Kaset — LINE UX Enhancement Implementation Guide

Status: implementation guide  
Last updated: 2026-04-28  
Audience: AI coders and developers adding LINE-native UX to the AgriSpark demo

---

## What Is Already Implemented

Do not re-implement these. They are live in the codebase.

| Feature | File | Notes |
|---------|------|-------|
| Loading animation (typing dots) | `message.ts:477` | 30-second timer, fire-and-forget |
| Quick replies (AI suggestion chips) | `message.ts:663`, `utils/quick-reply.ts` | Message action only — text sent as user message |
| Custom sender icon + name (per-agent persona) | `flex/reply.ts`, `flex/welcome.ts` | `Sender` type from `types.ts` |
| Flex message cards | `flex/reply.ts`, `flex/welcome.ts` | Bullet-threshold dispatch, welcome bubble |
| Sticker messages (friendly punctuation) | `utils/stickers.ts`, `message.ts:674` | 20% chance on short replies, WELCOME_STICKERS set |

---

## Overview of New Enhancements

Six UX improvements to implement, in priority order:

| # | Feature | Priority | Effort | Where it lands |
|---|---------|----------|--------|----------------|
| 1 | Mark messages as read | P0 | Low — 1 call | `message.ts` entry |
| 2 | Camera / camera roll quick reply | P0 | Low — extend `quick-reply.ts` | After diagnosis reply |
| 3 | Location quick reply | P1 | Low — extend `quick-reply.ts` | After weather reply |
| 4 | Datetime picker (farm log date) | P1 | Medium — postback handler | Log confirmation card |
| 5 | Clipboard action (copy summary) | P2 | Low — Flex footer button | Summary + diagnosis cards |
| 6 | Quote token on agent reply | P2 | Low — pass token through | Voice + long text replies |

---

## Enhancement 1 — Mark Messages as Read

**Why:** When a farmer sends a message and LINE OA chat mode is on, the message stays unread until the reply arrives. During the 3–10 seconds the LLM runs, the farmer sees an unread badge. Calling `markAsRead` immediately makes the chat look professional — the OA "read" the message the instant it arrived, and the typing animation shows the agent is composing.

**Where to add:** `features/line-oa/webhook/events/message.ts`, immediately before the loading animation call (line 476).

### Current code (line 474–478)

```typescript
// ② Loading animation — fire-and-forget
lineClient
  .showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 30 })
  .catch((err) => console.warn('[LINE] showLoadingAnimation failed:', err));
```

### Updated code

```typescript
// ② Mark as read immediately + loading animation — both fire-and-forget
const markAsReadToken = (event.message as { markAsReadToken?: string } | undefined)?.markAsReadToken;
if (markAsReadToken) {
  lineClient
    .markMessagesAsRead({ markAsReadToken })
    .catch((err) => console.warn('[LINE] markAsRead failed:', err));
}
lineClient
  .showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 30 })
  .catch((err) => console.warn('[LINE] showLoadingAnimation failed:', err));
```

**Notes:**
- `markAsReadToken` is only available when LINE OA Manager has **Chat** turned ON in Response settings. If Chat is off, messages are auto-read and the token is absent — the optional-chain guard handles this safely.
- The token has no expiration date and can be called multiple times with no error.
- No schema change, no new dependency.

---

## Enhancement 2 — Camera / Camera Roll Quick Reply

**Why:** After a plant diagnosis reply, the agent often says "ช่วยส่งรูปเพิ่มเติมได้ไหม". Without this, the farmer must dismiss the chat, open their gallery, and share. With camera/camera roll quick reply buttons, they tap once and the camera or gallery opens immediately inside LINE.

**Where to add:** `features/line-oa/webhook/utils/quick-reply.ts` (new builder functions), then call from `message.ts` after diagnosis replies.

### New functions in `utils/quick-reply.ts`

```typescript
import type { QuickReplyItem } from '../types';
import { QUICK_REPLY_LABEL_MAX } from '../types';

// existing buildQuickReplyItem stays unchanged

/** Quick reply button that opens the LINE camera */
export function buildCameraQuickReplyItem(label = '📷 ถ่ายรูปพืช'): QuickReplyItem {
  return {
    type: 'action',
    action: { type: 'camera', label: label.slice(0, QUICK_REPLY_LABEL_MAX) },
  };
}

/** Quick reply button that opens the device camera roll */
export function buildCameraRollQuickReplyItem(label = '🖼 เลือกรูปจากคลัง'): QuickReplyItem {
  return {
    type: 'action',
    action: { type: 'cameraRoll', label: label.slice(0, QUICK_REPLY_LABEL_MAX) },
  };
}
```

### Usage in message.ts — after diagnosis agent reply

In `runCanonicalLineReply`, after `buildReplyMessages` is called, detect whether the reply contains a follow-up photo request and inject the camera buttons:

```typescript
// After existing quickReplyItems construction (around line 663)

// Detect if agent reply is asking for a photo (pest-disease skill context)
const isAskingForPhoto =
  activeSk.includes('pest-disease-consult') &&
  /รูป|ภาพ|photo|ถ่าย|ส่งรูป/i.test(replyText);

const quickReplyItems = suggestions
  .filter((s) => s.trim().length > 0)
  .slice(0, isAskingForPhoto ? 1 : 3)          // leave room for camera buttons
  .map((s) => buildQuickReplyItem(s));

if (isAskingForPhoto) {
  quickReplyItems.push(buildCameraQuickReplyItem());
  quickReplyItems.push(buildCameraRollQuickReplyItem());
}

const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;
```

**Notes:**
- Camera and camera roll quick reply is available on LINE for iOS and Android only (not LINE for PC).
- The button disappears after the farmer takes or selects a photo — LINE handles dismissal automatically.
- Max 13 quick reply items total; camera buttons count toward this limit.
- `activeSk` refers to the list of active skill IDs resolved by `resolveAgentSkillRuntime()`. Pass it into `runCanonicalLineReply` or read it from the outer scope.

---

## Enhancement 3 — Location Quick Reply

**Why:** The weather-farm-risk skill needs a location. Currently the agent asks "อยู่จังหวัดไหนครับ" and the farmer types a province name. A location quick reply button opens LINE's GPS picker — the farmer taps once and coordinates come back as a location event, which the weather tool can use directly.

**Where to add:** `utils/quick-reply.ts` (new builder), `message.ts` (inject after weather reply when location was missing).

### New function in `utils/quick-reply.ts`

```typescript
/** Quick reply button that opens LINE's location picker (GPS) */
export function buildLocationQuickReplyItem(label = '📍 ส่งตำแหน่งฉัน'): QuickReplyItem {
  return {
    type: 'action',
    action: { type: 'location', label: label.slice(0, QUICK_REPLY_LABEL_MAX) },
  };
}
```

### Handling the location event in the webhook

Location messages arrive as a separate event type. Add a handler in `features/line-oa/webhook/index.ts` or `events/message.ts` for `msgType === 'location'`:

```typescript
// In the message event handler, add after the 'image' branch

if (msgType === 'location') {
  const loc = event.message as {
    type: 'location';
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Build a derived text that the weather skill can consume
  const locationText = loc.address
    ? `[ตำแหน่งของฉัน] ${loc.address} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`
    : `[ตำแหน่งของฉัน] พิกัด ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;

  // Route through canonical agent run — the weather tool will geocode the coordinates
  await runCanonicalLineReply({
    runtimeUserText: `ขอพยากรณ์อากาศสำหรับตำแหน่งนี้: ${locationText}`,
    storedUserText: locationText,
    memoryUserText: locationText,
  });
  return;
}
```

### Inject location button after weather reply

```typescript
// After existing quickReplyItems construction

const locationNeeded =
  activeSk.includes('weather-farm-risk') &&
  /จังหวัด|พื้นที่|ตำแหน่ง|location|province|where/i.test(replyText);

if (locationNeeded) {
  quickReplyItems.unshift(buildLocationQuickReplyItem()); // put GPS first
}
```

**Notes:**
- The location event comes through the same webhook endpoint as text messages.
- Open-Meteo (used by `lib/tools/weather.ts`) accepts latitude/longitude directly — passing coordinates avoids the Thai province name resolution step and is more accurate for small farms.
- If the farmer's LINE location sharing permission is denied, the button is greyed out — the agent text fallback ("พิมพ์ชื่อจังหวัด") stays in the message as the text body.

---

## Enhancement 4 — Datetime Picker (Farm Log Date)

**Why:** When the farm-record-keeper skill's log confirmation card (#7 in the Flex doc) shows "วันที่", the farmer has to type "28 เม.ย." or "วันนี้". A datetime picker button inside the Flex footer opens a native calendar picker in LINE. The farmer taps a date, and the postback handler receives the ISO date string and stores it against the pending log entry.

**Where to add:** `flex/records.ts` (add picker button to `buildLogConfirmCard` footer), `events/postback.ts` (add handler).

### Changes to `flex/records.ts` — add picker to log confirmation footer

In `buildLogConfirmCard`, replace or extend the footer:

```typescript
// In buildLogConfirmCard footer contents array, add before the confirm/cancel buttons:
{
  type: 'button',
  action: {
    type: 'datetimepicker',
    label: '📅 เลือกวันที่',
    data: `action=pick_log_date&token=${data.confirmToken}`,
    mode: 'date',
    initial: new Date().toISOString().slice(0, 10),  // today YYYY-MM-DD
    min: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),  // 90 days ago
    max: new Date().toISOString().slice(0, 10),
  },
  style: 'secondary',
  height: 'sm',
},
```

Full updated footer:

```typescript
footer: {
  type: 'box',
  layout: 'vertical',
  paddingAll: '12px',
  spacing: 'sm',
  contents: [
    {
      type: 'button',
      action: {
        type: 'datetimepicker',
        label: '📅 เลือกวันที่',
        data: `action=pick_log_date&token=${data.confirmToken}`,
        mode: 'date',
        initial: new Date().toISOString().slice(0, 10),
        min: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        max: new Date().toISOString().slice(0, 10),
      },
      style: 'secondary',
      height: 'sm',
    },
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยืนยัน',
            data: `action=confirm_log&token=${data.confirmToken}`,
            displayText: 'ยืนยันบันทึกกิจกรรม',
          },
          style: 'primary',
          color: LINE_GREEN,
          height: 'sm',
          flex: 1,
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยกเลิก',
            data: `action=cancel_log&token=${data.confirmToken}`,
            displayText: 'ยกเลิก',
          },
          style: 'secondary',
          height: 'sm',
          flex: 1,
        },
      ],
    },
  ],
},
```

### Postback handler in `events/postback.ts`

The datetime picker sends a postback event with `postback.params.date` (not `postback.data`). Add to the `handlePostbackEvent` function:

```typescript
// In handlePostbackEvent, add before the closing brace

// Datetime picker — pick_log_date
if (data.startsWith('action=pick_log_date')) {
  const params = new URLSearchParams(data);
  const token = params.get('token');
  const pickedDate = (event as { postback?: { params?: { date?: string } } })
    .postback?.params?.date; // YYYY-MM-DD from LINE

  if (token && pickedDate) {
    // Update the pending log entry date in your short-lived store
    await updatePendingLogDate(token, pickedDate);

    if (event.replyToken) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `📅 เลือกวันที่ ${formatThaiDate(pickedDate)} แล้ว กดยืนยันเพื่อบันทึก` }],
      });
    }
  }
  return;
}

// Confirm log
if (data.startsWith('action=confirm_log')) {
  const params = new URLSearchParams(data);
  const token = params.get('token');
  if (token) {
    const pendingLog = await getPendingLog(token);
    if (pendingLog) {
      await callRecordKeeperTool('log_activity', pendingLog);
      await deletePendingLog(token);
      if (event.replyToken) {
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '✅ บันทึกกิจกรรมเรียบร้อยแล้วครับ' }],
        });
      }
    }
  }
  return;
}

// Cancel log
if (data.startsWith('action=cancel_log')) {
  const params = new URLSearchParams(data);
  const token = params.get('token');
  if (token) await deletePendingLog(token);
  if (event.replyToken) {
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'ยกเลิกแล้ว พิมพ์ใหม่ได้เลยครับ' }],
    });
  }
  return;
}
```

### Pending log store

For the demo, a simple in-memory map keyed by token UUID is sufficient. For production, use the existing `db` with a `pendingLogEntry` table or a short-TTL Redis key.

```typescript
// features/line-oa/webhook/utils/pending-log-store.ts

type PendingLog = {
  date: string;
  activity: string;
  crop: string;
  area?: string;
  quantity?: string;
  cost?: string;
  notes?: string;
  lineUserId: string;
  channelId: string;
};

const store = new Map<string, PendingLog>();

export function setPendingLog(token: string, log: PendingLog): void {
  store.set(token, log);
  // Auto-expire after 10 minutes
  setTimeout(() => store.delete(token), 10 * 60 * 1000);
}

export function getPendingLog(token: string): PendingLog | undefined {
  return store.get(token);
}

export function updatePendingLogDate(token: string, date: string): void {
  const existing = store.get(token);
  if (existing) store.set(token, { ...existing, date });
}

export function deletePendingLog(token: string): void {
  store.delete(token);
}
```

### Thai date formatter

```typescript
// features/line-oa/webhook/utils/thai-date.ts

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Convert YYYY-MM-DD to Thai short date, e.g. "28 เม.ย. 2569" */
export function formatThaiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const thaiYear = (year ?? 0) + 543;
  const monthName = THAI_MONTHS[(month ?? 1) - 1] ?? '';
  return `${day} ${monthName} ${thaiYear}`;
}
```

**Notes:**
- `mode: 'date'` returns `postback.params.date` (YYYY-MM-DD). Use `mode: 'datetime'` if you need time-of-day too (returns `postback.params.datetime`).
- The datetime picker is available on LINE for iOS and Android only.
- The `initial`, `min`, `max` values must be ISO date strings in `YYYY-MM-DD` format regardless of display locale.

---

## Enhancement 5 — Clipboard Action (Copy Summary)

**Why:** After a weekly farm summary or diagnosis result, farmers often want to share the text in a LINE group with neighbors or an extension officer, or save it to their phone notes. A "คัดลอกสรุป" button copies a plain-text version to the clipboard — no manual selection needed.

**Where to add:** `flex/records.ts` (`buildWeeklySummaryCard` footer), `flex/diagnosis.ts` (`buildDiagnosisCard` footer). The clipboard text is a pre-formatted plain-text version of the card content, not the Flex JSON.

### In `buildWeeklySummaryCard` footer

```typescript
// Add as the last button in the footer, after "บันทึกกิจกรรมใหม่"
{
  type: 'button',
  action: {
    type: 'clipboard',
    label: '📋 คัดลอกสรุป',
    clipboardText: [
      `สรุปกิจกรรมฟาร์ม — ${data.period}`,
      ``,
      `งานที่ทำ: ${data.workCompleted}`,
      `ค่าใช้จ่าย/ผลผลิต: ${data.loggedOutput}`,
      `ขั้นตอนต่อไป: ${data.nextSteps}`,
      ``,
      `จาก Vaja: เกษตร`,
    ].join('\n'),
  },
  style: 'secondary',
  height: 'sm',
},
```

### In `buildDiagnosisCard` footer

```typescript
// Add after "ถามเพิ่มเติม" button
{
  type: 'button',
  action: {
    type: 'clipboard',
    label: '📋 คัดลอกผล',
    clipboardText: [
      `ผลวินิจฉัยโรคพืช`,
      ``,
      `ปัญหา: ${data.issue}`,
      `ความมั่นใจ: ${data.confidence}`,
      `ระดับความรุนแรง: ${data.severity}`,
      `ควรทำทันที: ${data.action}`,
      `ป้องกันรอบต่อไป: ${data.prevention}`,
      `ติดต่อเจ้าหน้าที่: ${data.escalate}`,
      ``,
      `จาก Vaja: เกษตร`,
    ].join('\n'),
  },
  style: 'secondary',
  height: 'sm',
},
```

**Notes:**
- `clipboardText` max length is 1000 characters. Truncate if the full summary could exceed this.
- The clipboard action works silently — no event is sent to the server when the farmer taps it.
- Supported on LINE for iOS and Android. On LINE for PC, the button renders but does nothing (safe fallback).
- The footer can contain at most a few buttons before LINE clips them on small screens — keep to 3 buttons maximum per card footer.

---

## Enhancement 6 — Quote Token on Agent Reply

**Why:** When a farmer sends a long voice transcript or a multi-line symptom description and the agent replies, the reply can quote the specific message it is answering. This prevents confusion in long conversations where the context scroll is many messages back.

**Where to add:** `events/message.ts` — capture `quoteToken` from the incoming webhook event and pass it to `replyMessage`.

### Capture the token

The `quoteToken` is in `event.message.quoteToken` in the raw webhook payload:

```typescript
// At the top of handleTextMessage (or wherever the message event is unpacked)
const quoteToken = (event.message as { quoteToken?: string } | undefined)?.quoteToken;
```

### Pass it to replyMessage

In `runCanonicalLineReply`, after building `textMessages`, attach the quote token to the first message in the reply:

```typescript
// Only quote on voice (long transcripts) or when the user message was long
const shouldQuote = quoteToken && (
  storedUserText.startsWith('[Voice]') ||
  storedUserText.length > 150
);

if (shouldQuote && textMessages.length > 0) {
  (textMessages[0] as Record<string, unknown>).quoteToken = quoteToken;
}

await lineClient.replyMessage({
  replyToken,
  messages: [...textMessages, ...imageMessages, ...stickerMessages],
});
```

**Notes:**
- Only text, sticker, image, video, template, and Flex messages can be quote targets. The `quoteToken` must be placed on the first message object in the reply array.
- When a quoted message is a Flex message, only its `altText` is shown in the quote preview bubble — make sure `altText` is always meaningful (already enforced in the Flex doc).
- Quote tokens have no expiration date.
- Do not quote on every reply — only where the context gap is large (voice notes, long text). Over-quoting clutters the chat.

---

## Enhancement Summary — Integration Checklist

Work in this order. Each item is independently shippable.

### 1 — Mark as read (30 minutes)
- [ ] Add `markAsRead` call in `message.ts` before `showLoadingAnimation`
- [ ] Verify LINE OA Manager has Chat mode ON for the demo channel
- [ ] Test: send a message on a real phone, confirm "อ่านแล้ว" appears before the reply

### 2 — Camera / camera roll quick reply (1 hour)
- [ ] Add `buildCameraQuickReplyItem` and `buildCameraRollQuickReplyItem` to `utils/quick-reply.ts`
- [ ] Add photo-request detection in `message.ts` quick reply construction block
- [ ] Export new builders from `utils/quick-reply.ts` (no index needed — direct import)
- [ ] Test: trigger a pest-disease diagnosis, confirm camera buttons appear

### 3 — Location quick reply (1 hour)
- [ ] Add `buildLocationQuickReplyItem` to `utils/quick-reply.ts`
- [ ] Add location event handler in the message handler (`msgType === 'location'` branch)
- [ ] Add location-needed detection in quick reply construction block
- [ ] Test: ask weather without a province, confirm location button appears; tap it and confirm GPS location is processed

### 4 — Datetime picker + pending log store (3 hours)
- [ ] Create `utils/pending-log-store.ts`
- [ ] Create `utils/thai-date.ts`
- [ ] Update `flex/records.ts` `buildLogConfirmCard` footer
- [ ] Add `pick_log_date`, `confirm_log`, `cancel_log` postback handlers in `events/postback.ts`
- [ ] Test: trigger a farm log, tap date picker, pick a date, confirm it saves with the correct date

### 5 — Clipboard action (30 minutes)
- [ ] Add clipboard button to `buildWeeklySummaryCard` footer in `flex/records.ts`
- [ ] Add clipboard button to `buildDiagnosisCard` footer in `flex/diagnosis.ts`
- [ ] Test: view a diagnosis card, tap "คัดลอกผล", paste into another chat — confirm the text is correct

### 6 — Quote token on agent reply (30 minutes)
- [ ] Capture `quoteToken` from `event.message` in `message.ts`
- [ ] Attach it to `textMessages[0]` for voice notes and long messages
- [ ] Test: send a long voice note, confirm the reply shows a quote of the original message

---

## Type Additions

Some of these features require narrowing the `event.message` type. The existing `LineEvent` type in `message.ts` uses a minimal local definition. Extend it as needed:

```typescript
// In message.ts, update the LineEvent type or use a local cast
type MessageEvent = {
  type: 'message';
  replyToken?: string;
  source?: { type: string; userId?: string; groupId?: string };
  message:
    | { type: 'text'; id: string; text?: string; quoteToken?: string; markAsReadToken?: string }
    | { type: 'image'; id: string; quoteToken?: string; markAsReadToken?: string }
    | { type: 'audio'; id: string; duration?: number; quoteToken?: string; markAsReadToken?: string }
    | { type: 'location'; id: string; latitude: number; longitude: number; address?: string }
    | { type: string; id: string; [key: string]: unknown };
};
```

Cast at the point of access with a type assertion rather than widening the shared `LineEvent` type — the shared type is also used by follow, postback, and beacon handlers.

---

## Testing on a Real Phone

LINE UX features render differently on device vs. the Flex Message Simulator. For each enhancement:

1. Deploy to a staging webhook URL (use `ngrok` or the staging Vercel preview URL)
2. Send the trigger message from a real LINE account on iOS or Android
3. Verify the quick reply buttons, picker, or clipboard appear as expected
4. Confirm the postback or location event is received by checking the server logs
5. Confirm the final reply arrives correctly

LINE for PC (macOS/Windows) does not support camera, camera roll, location quick replies, or datetime picker. The committee demo should be shown on a mobile phone.

---

## Files Modified or Created

```
features/line-oa/
  webhook/
    events/
      message.ts              ← mark-as-read, camera QR, location QR, quote token
      postback.ts             ← datetime picker handler, confirm/cancel log
    utils/
      quick-reply.ts          ← buildCameraQuickReplyItem, buildCameraRollQuickReplyItem,
                                 buildLocationQuickReplyItem  (add to existing file)
      pending-log-store.ts    ← new file
      thai-date.ts            ← new file
    flex/
      records.ts              ← datetime picker in log card, clipboard in summary card
      diagnosis.ts            ← clipboard in diagnosis card
```

No schema migrations required. No new npm packages required.
