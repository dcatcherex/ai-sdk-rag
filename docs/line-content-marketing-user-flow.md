# LINE × Content Marketing — End-to-End User Flow

This document describes every user-facing journey in the LINE + Content Marketing integration, from initial setup through publishing and analytics reporting.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (Web App)                              │
│                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ LINE OA  │  │Content Hub   │  │ Calendar │  │   Analytics      │  │
│  │ Settings │  │(Posts/Briefs)│  │ / Plans  │  │ (Metrics/A-B)   │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └──────────────────┘  │
└───────┼────────────────┼───────────────┼──────────────────────────────┘
        │                │               │
        ▼                ▼               ▼
┌──────────────┐  ┌────────────┐  ┌──────────────┐
│ LINE OA API  │  │ Neon DB    │  │  Cloudflare  │
│ (Messaging)  │  │ (Postgres) │  │  R2 Storage  │
└──────┬───────┘  └────────────┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LINE CHAT (Mobile)                               │
│                                                                         │
│  Regular users (followers) — interact with AI agents via LINE chat      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Flow 0 — Initial Setup (One-Time)

**Actor:** Brand admin / channel owner

```
[Dashboard] Create LINE OA Channel
    │  Enter: Channel name, LINE Channel ID, Channel Secret, Access Token
    │
    ▼
[DB] lineOaChannel record created
    │
    ▼
[Dashboard] Set webhook URL in LINE Developers Console
    │  URL: https://{your-domain}/api/line/[channelId]
    │
    ▼
[Optional] Attach an AI Agent
    │  Select: Default agent from Agents page
    │  Agent can have enabledTools: ['content_marketing', 'content_planning', 'line_analytics']
    │
    ▼
[Optional] Create Rich Menus
    │  Design areas → set actions (switch_agent, postback, uri, message)
    │  Upload background image → Deploy to LINE
    │
    ▼
[LINE] Channel is live — followers can now message the bot
```

---

## Flow 1 — Account Linking (Connect LINE User → App User)

**Why:** Unlocks per-user features: draft saving, metric logging, approval actions from LINE.

```
[Dashboard] Settings → LINE OA → Link Account
    │  Click "Generate Token"
    │
    ▼
[App] generateLinkToken(channelId, userId)
    │  Creates 8-char token (e.g. "A3BK7PQX"), expires in 15 min
    │
    ▼
[User] Opens LINE → messages bot: "/link A3BK7PQX"
    │
    ▼
[Webhook] handleMessageEvent → consumeLinkToken(token, lineUserId, channelId)
    │  Validates token not expired and not used
    │  Fetches LINE profile (displayName, pictureUrl)
    │  Creates lineAccountLink record
    │
    ▼
[LINE] Bot replies: "Your account has been linked successfully! 🎉"
    │
    ▼
[Dashboard] Linked accounts visible under LINE OA → Links
```

---

## Flow 2 — Content Creator Agent (Social Posts from LINE)

**Actor:** Marketer / content creator  
**Requires:** Agent with `enabledTools: ['content_marketing']` assigned to channel  
**Agent Template:** `tpl_line_content_creator`

```
[LINE] User: "Create Instagram captions for our summer sale promotion"
    │
    ▼
[Webhook] handleMessageEvent
    │  Detects enabledTools includes 'content_marketing'
    │  Calls buildContentMarketingLineTools(linkedUser.userId)
    │
    ▼
[AI] generateText({ tools: contentTools, maxSteps: 3 })
    │
    │  Tool: generate_caption
    │    → generateCaptions({ topic, platforms: ['instagram'], tone })
    │    → Returns base caption + platform-specific version with hashtags
    │
    ▼
[LINE] Bot replies with caption text
    │
    ▼
[User]: "Generate a banner image for this"
    │
    ▼
[AI] Tool: generate_image
    │  → generateImage({ model: 'openai/gpt-image-1.5', prompt })
    │  → uploadPublicObject(key, buffer) → R2 → public URL
    │  Returns: { imageUrl }
    │
    ▼
[Webhook] Collects imageUrl from toolResults[].output.imageUrl
    │  Appends LINE image message to reply
    │
    ▼
[LINE] Bot replies: text reply + image message (2 bubbles)
    │
    ▼
[User]: "Save this as a draft"
    │
    ▼
[AI] Tool: save_draft
    │  → createPost({ userId, caption, platforms, media: [{ url }] })
    │  → socialPost record created in DB (status: 'draft')
    │
    ▼
[LINE] Bot: "Draft saved (ID: abc12345). View it in Content Hub → Posts."
    │
    ▼
[Dashboard] Content Hub → Posts → draft visible, ready to schedule/publish
```

**Fallback (non-linked user):**
```
[AI] save_draft execute()
    │  userId is null
    ▼
[LINE] "Your LINE account is not linked. Type /link TOKEN to connect..."
```

---

## Flow 3 — Image Reference (User Sends Photo to Agent)

**Actor:** Marketer providing a reference image

```
[LINE] User sends a photo (product photo, design reference, competitor post)
    │
    ▼
[Webhook] handleMessageEvent — msgType === 'image'
    │  Downloads image via MessagingApiBlobClient
    │  Converts to base64
    │
    ▼
[AI] generateText with vision model
    │  Content: [{ type: 'image', image: base64, mediaType: 'image/jpeg' }]
    │  System prompt: "Reply via LINE. Plain text only."
    │
    ▼
[LINE] Bot: Analysis/description of the image with suggestions
    │  Includes quick reply buttons (follow-up suggestions)
```

---

## Flow 4 — Content Planner Agent (Calendar from LINE)

**Actor:** Campaign manager / marketing lead  
**Requires:** Agent with `enabledTools: ['content_planning']`  
**Agent Template:** `tpl_content_planner`

```
[LINE] User: "Plan a 2-week Instagram campaign for our product launch on June 1st"
    │
    ▼
[AI] generateText({ tools: plannerTools, maxSteps: 3 })
    │
    │  Tool: create_campaign
    │    → createCampaignBrief(userId, { title, goal, channels, startDate, endDate })
    │    → campaignBrief record created (status: 'draft')
    │    Returns: { campaignId, title }
    │
    ▼
[LINE] Bot: "Campaign created: 'Product Launch June 2026' (ID: abc12345)"
    │
    ▼
[User]: "Add a teaser post for May 28th and a launch post for June 1st"
    │
    ▼
[AI] Tool: add_calendar_entry (called twice)
    │  → createCalendarEntry(userId, { title, contentType: 'social', channel: 'instagram',
    │      plannedDate, campaignId, status: 'idea' })
    │
    ▼
[LINE] Bot: "Added 2 entries to your calendar. View in Content Calendar."
    │
    ▼
[User]: "What's scheduled for June?"
    │
    ▼
[AI] Tool: list_upcoming_entries
    │  → getCalendarEntries(userId, { year: 2026, month: 6 })
    │
    ▼
[LINE] Bot: Lists entries with dates, content types, and statuses
    │
    ▼
[Dashboard] Content Calendar → entries visible on calendar/kanban board
```

---

## Flow 5 — Approval Workflow via LINE

**Actor:** Content creator (requester) + Reviewer (assignee)  
**Requires:** Both users have linked LINE accounts

### 5a — Submitting for Review

```
[Dashboard] Content Piece → "Request Approval"
    │  Select assignee (workspace member), optional due date
    │
    ▼
[API] POST /api/approvals
    │  createApprovalRequest({ contentPieceId, requesterId, assigneeId, dueAt })
    │  contentPiece.status → 'in_review'
    │
    ▼
[Service] Sends email notification to assignee
    │
    ▼
[Service] notifyAssigneeViaLine(assigneeId, approvalRequest, contentTitle)
    │  Looks up lineAccountLink for assignee
    │  Pushes message to all linked LINE channels
    │
    ▼
[LINE — Reviewer's Phone]
    ┌─────────────────────────────────────┐
    │ 📋 New approval request             │
    │                                     │
    │ "Summer Sale Instagram Caption"     │
    │ Due: June 5, 2026                   │
    │                                     │
    │ Please review and respond:          │
    │ [✅ Approve] [↩️ Changes] [❌ Reject]│
    └─────────────────────────────────────┘
```

### 5b — Reviewer Approves from LINE

```
[LINE] Reviewer taps "✅ Approve" quick reply button
    │  Postback data: "approve_content:{requestId}"
    │
    ▼
[Webhook] handlePostbackEvent
    │  Looks up lineAccountLink → gets resolverId (app userId)
    │  Calls resolveApprovalRequest(requestId, resolverId, { status: 'approved' })
    │  contentPiece.status → 'approved'
    │
    ▼
[Service] notifyRequesterViaLine(requesterId, { status: 'approved' }, contentTitle)
    │
    ▼
[LINE — Creator's Phone]
    ┌──────────────────────────────────────────┐
    │ Your content "Summer Sale Instagram      │
    │ Caption" has been ✅ approved.           │
    └──────────────────────────────────────────┘
    │
    ▼
[Dashboard] Approval request shows 'approved' — content ready to distribute
```

### 5c — Reviewer Requests Changes

```
[LINE] Reviewer taps "↩️ Changes"
    │  Postback: "request_changes:{requestId}"
    │
    ▼
[Webhook] resolveApprovalRequest(requestId, resolverId, { status: 'changes_requested' })
    │  contentPiece.status → 'draft'
    │
    ▼
[LINE — Creator's Phone]: "...has been ↩️ returned for changes."
    │
    ▼
[Creator] Revises content on dashboard → submits new approval request
```

---

## Flow 6 — Distribution (Broadcast Approved Content to LINE)

**Actor:** Content marketer

```
[Dashboard] Content Piece (status: 'approved') → Distribution tab → LINE tab
    │
    ▼
[UI] DistributionPanel — LINE tab
    │  Lists connected LINE OA channels (from useLineOaChannels)
    │  User selects channel → clicks "Broadcast to followers"
    │
    ▼
[API] POST /api/distribution/line-broadcast
    │  { contentPieceId, channelId }
    │  Loads content piece (verifies ownership)
    │  Builds message text: excerpt → full body → title (stripped of markdown)
    │  Truncates to 2000 chars
    │
    ▼
[Service] createBroadcast(channelId, userId, { name, messageText })
    │  lineBroadcast record (status: 'draft')
    │
    ▼
[Service] sendBroadcast(broadcastId, userId)
    │  LINE Broadcast API call
    │  lineBroadcast status → 'sent', recipientCount set
    │
    ▼
[DB] distributionRecord created: { channel: 'line_broadcast', status: 'sent', recipientCount }
    │
    ▼
[UI] Distribution History tab shows the broadcast with recipient count and date
    │
    ▼
[LINE — All Followers] Receive the content as a broadcast message
```

---

## Flow 7 — Agent Switching via Rich Menu

**Actor:** LINE follower who wants to switch between specialist agents

```
[LINE] User opens rich menu — sees agent buttons:
    │  e.g. [📝 Content Creator] [📅 Planner] [📊 Metrics]
    │
    ▼
[LINE] User taps "📊 Metrics"
    │  Postback data: "switch_agent:tpl_metrics_reporter"
    │
    ▼
[Webhook] handlePostbackEvent
    │  Upserts lineUserAgentSession { channelId, lineUserId, activeAgentId }
    │  Fetches agent name
    │
    ▼
[LINE] Bot: "Switched to Metrics Reporter. How can I help you?"
    │
    ▼
[Subsequent messages] handleMessageEvent
    │  Loads lineUserAgentSession → activeAgentId overrides channel default
    │  Agent's enabledTools: ['line_analytics'] → injects metrics tools
```

---

## Flow 8 — Metrics Logging from LINE

**Actor:** Marketer reporting content performance  
**Requires:** Agent with `enabledTools: ['line_analytics']`  
**Agent Template:** `tpl_metrics_reporter`

```
[LINE] User: "Our Instagram reel got 5000 views, 420 likes, 80 shares yesterday"
    │
    ▼
[AI] generateText({ tools: metricsTools, maxSteps: 3 })
    │
    │  Tool: list_recent_content
    │    → DB: recent contentPiece rows for userId
    │    Returns: [{ id, title, status }...]
    │
    ▼
[LINE] Bot: "Here are your recent pieces:
    │  1. Summer Sale Caption (ID: abc12345)
    │  2. Product Launch Reel (ID: def67890)
    │  Which one should I log this for?"
    │
    ▼
[User]: "The product launch reel"
    │
    ▼
[AI] Tool: log_content_metric
    │  → trackMetric(userId, { contentPieceId, platform: 'instagram',
    │      views: 5000, engagement: 500 })
    │  Auto-calculates CTR if impressions + clicks provided
    │
    ▼
[LINE] Bot: "Metrics logged for instagram. CTR: n/a"
    │
    ▼
[User]: "How is this piece performing overall?"
    │
    ▼
[AI] Tool: get_content_performance
    │  → getContentPerformanceSummary(userId, contentPieceId)
    │
    ▼
[LINE] Bot: "• Total views: 5000
    │  • Total engagement: 500
    │  • Platforms: instagram
    │  Performance summary across 1 platform."
    │
    ▼
[User]: "Show me channel stats for the last 7 days"
    │
    ▼
[AI] Tool: get_channel_stats
    │  → getChannelStats(channelId, 7)
    │
    ▼
[LINE] Bot: "87 messages over the last 7 days. Peak: 23 messages on 2026-04-01.
    │  • Unique users: 14
    │  • Tool calls: 31
    │  • Images sent: 8"
```

---

## Complete End-to-End Journey (Composite)

```
WEEK 1 — PLAN
  Brand Admin sets up LINE OA channel + attaches Content Planner agent
  Team members link their LINE accounts (Flow 1)
  Campaign Manager: "Plan a June product launch campaign" via LINE (Flow 4)
    → CampaignBrief created, CalendarEntries added

WEEK 2 — CREATE
  Marketer switches to Content Creator agent via rich menu (Flow 7)
  Marketer: "Write Instagram captions for the launch" via LINE (Flow 2)
    → Captions generated, draft saved to Content Hub

WEEK 3 — REVIEW
  Creator submits content for approval from Dashboard (Flow 5a)
    → Reviewer receives LINE notification with quick reply buttons
  Reviewer approves from LINE — no need to open the dashboard (Flow 5b)
    → Creator notified on LINE

WEEK 4 — PUBLISH
  Approved content broadcast to all LINE followers (Flow 6)
    → distributionRecord logged with recipientCount

WEEK 5 — MEASURE
  Marketer switches to Metrics Reporter agent (Flow 7)
  Reports Instagram engagement numbers via LINE (Flow 8)
    → Metrics stored against contentPiece
  Auto-collected stats: messageCount, uniqueUsers already tracked
```

---

## Data Model Relationships

```
lineOaChannel ──────────────────────────┐
    │                                    │
    ├── lineConversation (per user)       │
    ├── lineRichMenu                      │
    ├── lineBroadcast                     ├── lineChannelDailyStat (per day)
    ├── lineAccountLink (linked users)    │
    └── lineUserAgentSession             ─┘

lineAccountLink
    └── user ──────┬── socialPost (content_marketing)
                   ├── campaignBrief (content_planning)
                   ├── contentCalendarEntry
                   ├── contentPiece ──── approvalRequest
                   │                 └── distributionRecord
                   └── contentPieceMetric (analytics)

agent (templates)
    ├── tpl_line_content_creator  [enabledTools: content_marketing]
    ├── tpl_content_planner       [enabledTools: content_planning]
    ├── tpl_metrics_reporter      [enabledTools: line_analytics]
    └── tpl_social_image          [enabledTools: content_marketing]
```

---

## Quick Reference — LINE Tool Capabilities per Agent

| Agent Template | Tool IDs | What users can do from LINE |
|---|---|---|
| `tpl_line_content_creator` | `content_marketing` | Generate captions, generate images, save drafts, list drafts |
| `tpl_social_image` | `content_marketing` | Same as above, image-focused system prompt |
| `tpl_content_planner` | `content_planning` | Create campaigns, add calendar entries, list upcoming |
| `tpl_metrics_reporter` | `line_analytics` | Log post metrics, view performance, channel stats |
| Any agent | _(combine)_ | Set `enabledTools` to multiple values to combine |
