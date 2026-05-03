# LINE Webhook Architecture Guide

For AI coders and developers working in `features/line-oa/webhook/`.

---

## Core Rule

> The webhook is an **orchestrator**, not a handler.
> `index.ts` routes events. `message.ts` routes message types. Neither does domain work inline.

Domain work — memory resolution, prompt building, command handling — lives in named helper functions at the bottom of each file or in dedicated handler files.

---

## Request Flow

```
LINE platform
  ↓ POST /api/line/[channelId]
index.ts :: POST()
  1. Verify signature (HMAC-SHA256)
  2. Look up channel record, check active status
  3. Return 200 immediately
  4. after() → processEvents()

processEvents()
  5. Load channel default agent (getAgentById)
  6. Fetch brand logo for sender icon
  7. Build Sender object (name ≤ 20 chars + iconUrl)
  8. Init LINE client (MessagingApiClient)
  9. Loop: route each event to its handler
```

---

## Event Routing (index.ts)

| Event type | Handler | Notes |
|-----------|---------|-------|
| `follow` | `handleFollowEvent` | Welcome message, rich menu setup |
| `message` | `processEvents` inline → `handleMessageEvent` | Main AI path — see below |
| `postback` | `handlePostbackEvent` | Rich menu button actions |
| `beacon` | `handleBeaconEvent` | Location beacon triggers |

The `message` event does extra work before delegating: resolves conversation context, detects management bot path, resolves the effective agent.

---

## Message Event Path (the critical path)

```
message event arrives
  ↓
resolveConversationContext()    4 parallel DB queries → linkedUser, activeAgentId,
                                storedMenuId, defaultMenuId

  ↓
management bot check            if channel owner + not group + not image gen
  → handleManagementBotEvent()  platform control commands, skip AI path

  ↓
resolveEffectiveAgent()         user's active session agent > channel default
                                fetches override agent only when different

  ↓ (fire-and-forget, non-blocking)
restore rich menu               re-link user's stored menu if differs from default
maybeSyncUserProfile()          refresh display name/picture (24h TTL)

  ↓
handleMessageEvent()            delegates to message.ts
```

---

## Two Key Helpers in index.ts

### `resolveConversationContext`

Fetches four things in a single `Promise.all`:

| Result | Source table | Keyed by |
|--------|-------------|----------|
| `linkedUser` | `lineAccountLink` | individual `lineUserId` |
| `activeAgentId` | `lineUserAgentSession` | conversation key (groupId or lineUserId) |
| `storedMenuId` | `lineUserMenu` | conversation key |
| `defaultMenuId` | `lineRichMenu` | channel + isDefault |

Returns typed `ConversationContext`. If neither `lineUserId` nor `conversationUserId` exists, returns early with empty values — no DB queries fired.

**Group chat note**: `conversationUserId = groupId ?? lineUserId`. Account link is always keyed by individual `lineUserId` even inside groups. Session and menu are keyed by group so all members share one agent state.

### `resolveEffectiveAgent`

```
input:  activeAgentId (from session), channelAgentId (default), channel defaults
output: { agentRow, systemPrompt, modelId, sender }
```

Rule: if `activeAgentId` is set and differs from channel default → fetch and use that agent. Otherwise fall through to channel defaults. The channel default agent was already fetched in `processEvents`; this only fires one extra query when the user has switched agents.

---

## Message Handler Orchestrator (message.ts)

`handleMessageEvent` is a ~115-line orchestrator. Reading it top-to-bottom tells the whole message story:

```
validate gates          replyToken present, msgType in {text,image,audio,video}, lineUserId present

handleTextCommand()     /link, สมัครสมาชิก/register, เติมเครดิต/topup, package 1-4
                        returns true if handled → return early, skip AI path

showLoadingAnimation    non-blocking, 30s loading indicator shown to user

getOrCreateConversation get or create DB thread for this conversation

fetch history           last MAX_CONTEXT_MESSAGES messages, filter user/assistant, extract text

buildLineAgentContext() memory, brand, domain, full system prompt, lineExtraBlocks, skill hints

runLineReply closure    thin wrapper around runCanonicalLineReply with all context bound

route to handler        image → handleImageMessage
                        audio → handleAudioMessage
                        video → handleVideoMessage
                        text  → handleTextMessage
```

---

## Two Key Helpers in message.ts

### `handleTextCommand`

Returns `boolean` — `true` if a command was consumed, `false` to fall through to the AI path.

| Trigger | Action |
|---------|--------|
| `/link XXXXXXXX` | Consume account-link token |
| `สมัครสมาชิก` / `สมัคร` / `/register` / `register` | Register LINE user → Vaja account |
| `เติมเครดิต` / `เติมเงิน` / `/topup` / `topup` | Show credit package menu |
| `1` / `2` / `3` / `4` | Select credit package → create payment order → send QR |

**Rule**: all user-facing command strings live here. Never add command-matching logic to `handleMessageEvent` or the AI path.

### `buildLineAgentContext`

Builds everything the AI path needs:

```typescript
return {
  memoryContext,       // injected user/LINE memory
  shouldExtractMemory, // whether to run memory extraction after reply
  lineSystemPrompt,    // full assembled system prompt for this channel
  activeBrand,         // resolved brand (for certificate/content tools)
  domainContext,       // domain profiles + entities for this user
  lineExtraBlocks,     // tagged XML context blocks (<line_group_context> etc.)
  followUpSkillHints,  // up to 4 active skill names for follow-up suggestions
};
```

Memory branching rule:
- **Linked user** → check preferences → inject if enabled, extract based on prefs
- **Unlinked LINE user** → always inject LINE-scoped memory, always extract

LINE-specific prompt additions (no markdown, plain text, bullet `•`) are applied inside this function before `buildAgentRunSystemPrompt`. Do not add them in `handleMessageEvent`.

---

## Agent Resolution Priority

```
1. User's active session agent     (lineUserAgentSession.activeAgentId)
   — set when user taps a rich menu button that switches agent
2. Channel default agent           (lineOaChannel.agentId)
   — configured by channel owner in the control room
3. No agent                        agentRow = null
   — base system prompt only, no agent persona
```

The management bot path (channel owner messaging their own channel) bypasses this entirely and goes to `handleManagementBotEvent`.

---

## Group Chat vs 1:1

| Concern | 1:1 | Group |
|---------|-----|-------|
| Conversation key | `lineUserId` | `groupId` |
| Agent session | per user | shared across group |
| Rich menu | per user | shared across group |
| Account link | per user | per user (still individual) |
| Management bot | yes (if owner) | never |
| Prompt context | user name | group note + sender name |

`lineExtraBlocks` wraps the appropriate context in `<line_group_context>` or `<line_user_context>` tags so the AI understands who it is talking to.

---

## Adding a New Text Command

1. Add the match inside `handleTextCommand` in `message.ts`
2. Return `true` after replying — never fall through to the AI path
3. Keep the reply in plain text (no markdown — LINE renders it literally)

```typescript
// Example — add inside handleTextCommand()
const isHelpCommand = userText.toLowerCase() === '/help';
if (isHelpCommand) {
  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: 'Help text here...' }],
  });
  return true;
}
```

---

## Adding a New Event Type

1. Add the type to `WebhookEvent` in `index.ts`
2. Add a handler file `features/line-oa/webhook/events/your-event.ts`
3. Export the handler function, import it in `index.ts`
4. Add the routing block inside the `for (const event of body.events)` loop:

```typescript
if (event.type === 'your-event') {
  await handleYourEvent(event, lineClient, { id: channel.id, ... });
}
```

Never put handler logic directly in the loop. The loop is routing only.

---

## Adding a New DB Query to Context

If a new piece of per-user or per-conversation data is needed on every message:

1. Add it to the `Promise.all` inside `resolveConversationContext` in `index.ts`
2. Add the result field to `ConversationContext`
3. Return it from the function
4. Destructure it at the call site

Do not add inline DB queries to `handleMessageEvent` or the event loop. All per-message context fetching belongs in `resolveConversationContext`.

---

## Key Files

| File | Purpose |
|------|---------|
| `features/line-oa/webhook/index.ts` | Entry point: signature verification, event routing, `resolveConversationContext`, `resolveEffectiveAgent` |
| `features/line-oa/webhook/events/message.ts` | Message orchestrator: `handleTextCommand`, `buildLineAgentContext`, media routing |
| `features/line-oa/webhook/events/text-replies.ts` | AI text reply: `runCanonicalLineReply`, `handleTextMessage` |
| `features/line-oa/webhook/events/media-handlers.ts` | Image, audio, video message handling |
| `features/line-oa/webhook/events/postback.ts` | Rich menu button actions |
| `features/line-oa/webhook/management-bot.ts` | Channel owner platform control commands |
| `features/line-oa/webhook/db.ts` | `getOrCreateConversation` |
| `features/line-oa/webhook/types.ts` | `AgentRow`, `LinkedUser`, `Sender`, `MessagePart`, constants |
| `features/line-oa/link/service.ts` | Account linking, user registration |
| `features/line-oa/payment/service.ts` | Credit package payment orders |
| `features/agents/server/queries.ts` | `getAgentById` — trusted bare lookup |

---

## Checklist: Common Tasks

**Add a text command**
- [ ] Match in `handleTextCommand` in `message.ts`
- [ ] Return `true` after replying
- [ ] Plain text reply only

**Change what data is in conversation context**
- [ ] Modify `resolveConversationContext` in `index.ts`
- [ ] Update `ConversationContext` type
- [ ] Update destructuring at call site

**Change the LINE system prompt**
- [ ] Modify `buildLineAgentContext` in `message.ts`
- [ ] The LINE-specific instructions (no markdown etc.) are built here before `buildAgentRunSystemPrompt`

**Add a new event handler**
- [ ] New file in `events/`
- [ ] Import and route in `index.ts` event loop
- [ ] No logic in the loop itself

**Change agent selection logic**
- [ ] Modify `resolveEffectiveAgent` in `index.ts`
- [ ] Do not touch `handleMessageEvent` for this
