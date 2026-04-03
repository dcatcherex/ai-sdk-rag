# End-to-End Content Marketing — User Guide

> **Audience:** Marketers, content teams, and business owners using this platform.
> **Purpose:** Explains the complete content marketing workflow the app supports and why every stage of the content lifecycle is covered.

---

## Table of Contents

1. [Why "end-to-end" matters](#1-why-end-to-end-matters)
2. [The content marketing lifecycle](#2-the-content-marketing-lifecycle)
3. [Stage 1 — Brand foundation](#3-stage-1--brand-foundation)
4. [Stage 2 — Campaign planning](#4-stage-2--campaign-planning)
5. [Stage 3 — Content production](#5-stage-3--content-production)
6. [Stage 4 — Review and governance](#6-stage-4--review-and-governance)
7. [Stage 5 — Distribution](#7-stage-5--distribution)
8. [Stage 6 — Analytics and optimization](#8-stage-6--analytics-and-optimization)
9. [How AI agents accelerate every stage](#9-how-ai-agents-accelerate-every-stage)
10. [Full user journey walkthrough](#10-full-user-journey-walkthrough)
11. [Feature map](#11-feature-map)

---

## 1. Why "end-to-end" matters

Most content tools solve one problem in isolation — a caption generator here, a scheduling tool there, an analytics dashboard somewhere else. The result is a fragmented workflow where:

- Brand guidelines live in a separate document nobody reads before writing
- Content is created without a campaign goal attached to it
- Drafts go back and forth over email for approval
- Distribution is manual copy-paste into each channel
- Performance data never feeds back into future content decisions

This app connects all six stages into a single workspace. Brand context informs every piece of content an AI generates. A campaign brief links planning to production. Approval workflows are built into the same interface where content is written. Distribution is a single click. Analytics flow back to the AI so recommendations are grounded in real data.

---

## 2. The content marketing lifecycle

```
Brand Foundation
      │
      ▼
Campaign Planning  ──────────────────────────┐
      │                                       │
      ▼                                       │
Content Production                            │
      │                                       │
      ▼                                       │
Review & Governance  (guardrails + approvals) │
      │                                       │
      ▼                                       │
Distribution  (email · export · webhook)      │
      │                                       │
      ▼                                       │
Analytics & Optimization  ───────────────────┘
      │
      └── Insights feed back into next campaign
```

Each stage is a feature set in the app. They share the same database, so data created in one stage is automatically available in all others.

---

## 3. Stage 1 — Brand foundation

**Where:** Settings → Brands

Before any content is created, the app needs to understand who the brand is. This is not a one-time configuration — it is an active knowledge layer that every AI generation step references automatically.

### What you set up

**Profile tab**
- Brand name, overview, website URL, industry, and target audience.
- This is the minimum needed to generate on-brand content.

**Voice & Values tab**
- Tone of voice keywords (e.g. "empowering, conversational, expert")
- Brand values (e.g. "real-world experience, curiosity, inclusion")
- Writing dos and don'ts — specific rules the AI must follow

**Strategy tab**
- Positioning statement — the one sentence that defines why this brand exists
- Messaging pillars — the 3–5 core themes every piece of content should reinforce
- Proof points — evidence and statistics that support the positioning
- Ideal Customer Profiles (ICPs) — detailed personas including age range, job title, pain points, buying triggers, and objections

**Visual tab**
- Visual aesthetic keywords
- Font names
- Brand color palette with hex values and labels

**Guardrails tab**
- Rules that block or warn when content violates brand standards
- Two enforcement modes:
  - **Pattern** — regex-based keyword and phrase detection
  - **Semantic** — AI reads the content and checks it against brand knowledge documents
- Three severity levels: `block` (prevents publishing), `warning` (requires sign-off), `info` (advisory only)

**Knowledge tab**
- Upload brand documents: brand book, style guide, product sheets, press kit
- The AI retrieves relevant passages from these during generation and guardrail checking

**Sharing tab** _(owners only)_
- Invite team members to use this brand in their chat sessions
- Shared members can generate with the brand but cannot edit or delete it

### Why this matters

Every content generation step in the app accepts a `brandId`. When present, the AI receives a full brand context block containing all of the above before generating any content. The result is that a blog post, a social caption, and an email campaign written for the same brand all have consistent tone, consistent messaging, and consistent guardrail enforcement — even when written by different team members or different AI agents.

---

## 4. Stage 2 — Campaign planning

**Where:** Content Calendar (`/content-calendar`)

### Campaign briefs

A campaign brief is the strategic anchor for a batch of content. It answers:

| Field | Question it answers |
|-------|-------------------|
| Title | What is this campaign called? |
| Goal | What business outcome are we driving? |
| Offer | What is the specific thing we are promoting? |
| Key message | What is the single most important thing the audience should understand? |
| CTA | What do we want the audience to do? |
| Channels | Where will this content appear? |
| Start / End date | When does this campaign run? |

Briefs are linked to a brand, so all the brand's strategic context is automatically attached. The Campaign Brief Generator agent team can research an audience, apply brand strategy, and write a brief automatically from a single prompt.

### Content calendar

The calendar has two views:

**Monthly grid view**
- See all planned content across a month at a glance
- Color-coded entries by content type or status
- Click any date to create a new entry

**Kanban board view**
- Columns map to the eight content statuses: Idea → Briefed → Drafting → Review → Approved → Scheduled → Published → Repurposed
- Drag cards between columns to update status
- Filter by brand or campaign

Each calendar entry records:
- Title and content type (blog post, email, social post, video, etc.)
- Channel (LinkedIn, Instagram, email, etc.)
- Planned date
- Link to a campaign brief (optional)
- Link to a content piece once produced (optional)
- Color tag for visual organization

### User flow for planning

1. Create a brand (Stage 1)
2. Open Content Calendar → Campaigns tab → create a brief
3. Use the calendar to map out what content types and channels are needed for the campaign
4. Each entry becomes a production ticket for Stage 3

---

## 5. Stage 3 — Content production

**Where:** Tools → Long-form Content, Tools → Content Marketing, Chat

### Long-form content

The Long-form Content tool generates full-length content pieces:

| Content type | What gets generated |
|-------------|-------------------|
| Blog post | SEO-optimized article with title, body (markdown), and excerpt |
| Newsletter | Email newsletter with subject line and HTML-ready body |
| Email sequence | Multi-step drip sequence with subject lines |
| Landing page | Conversion-focused page copy with headline, benefits, CTA |

All generators accept a brand ID. When provided, the AI receives the full brand context block before writing.

Generated content is saved as a **content piece** — a database record with a stable ID. Every content piece has:
- Title, body (markdown), excerpt
- Content type and channel
- Status (draft → review → approved → published)
- Brand association
- Optional parent link (used by repurposing)

### Repurposing

The Repurposing tool takes one source content piece and transforms it into multiple formats simultaneously:

| Output format | Description |
|--------------|-------------|
| LinkedIn post | Professional long-form post optimized for the LinkedIn algorithm |
| Tweet thread | Multi-tweet thread with hooks and call-to-action |
| Instagram caption | Conversational caption with hashtag suggestions |
| Email newsletter | Adapted version for email audience |
| Short-form blog | Condensed 400–600 word version |
| Ad copy | Three short ad headlines + descriptions |
| Video script | 60–90 second spoken script |

All repurposed pieces are saved as content pieces with a `parentId` pointing to the source. This creates a content tree you can navigate in the library.

### AI Chat and Agent Teams

Content can also be produced directly in the AI chat interface with any enabled tool. More powerful is the Agent Teams feature, which lets multiple specialist AI agents collaborate on a single production task:

- **Content Pipeline** — Researcher → Writer → Editor in sequence
- **Repurposing Engine** — Analyst + Long-form Writer + Social Copywriter + Email Writer + Creative Director in parallel
- **Campaign Brief Generator** — Market Researcher + Brand Strategist + Brief Writer

### Content piece library

The Long-form Content tool's Library tab shows all content pieces for the user, filterable by type and status. Each piece shows its title, type, status, and creation date.

---

## 6. Stage 4 — Review and governance

**Where:** Built into every content piece; Brand Settings → Guardrails

### Guardrail checking

Every time a content piece is ready for review, it can be checked against the brand's guardrail rules. The check runs in two phases:

**Phase 1 — Pattern scan**
Rules with a `pattern` field are evaluated as regular expressions against the content body. This catches:
- Forbidden phrases or competitor names
- Required format patterns (e.g. must include a CTA)
- Prohibited language (e.g. medical claims, pricing that must not appear)

**Phase 2 — Semantic check**
For rules without a pattern (or as a second pass), the AI reads the content and evaluates it against the brand's knowledge documents. This catches:
- Tone violations that regex cannot detect ("too formal for our youthful voice")
- Factual inconsistencies with the brand book
- Missing messaging pillar coverage

Each violation is returned with:
- The rule that was triggered
- A severity level (block / warning / info)
- The specific text passage that caused the violation
- A suggestion for how to fix it

The `brand_guardrails` agent tool exposes this to any AI agent, so the Brand Review agent team can automatically check and rewrite non-compliant content without human intervention.

### Approval workflow

For teams with multiple members:

1. A writer submits a content piece for approval — this creates an **approval request** linked to the content piece
2. The request is assigned to a reviewer (editor, brand manager, legal, etc.)
3. The reviewer sees the content and can: **Approve**, **Request changes**, or **Reject**
4. When an approval request is created or resolved, the relevant party receives an email notification via Resend
5. The content piece status updates automatically: approval → `approved`, rejection → `draft`

Approval requests track:
- Requester and assignee
- Optional due date
- Resolution timestamp and note

### Threaded comments

Any content piece can have a comment thread attached to it. Comments support:
- Nested replies
- Mark as resolved
- Resolver tracking (who resolved it and when)

This replaces the "feedback over email" pattern that breaks content context. All discussion about a specific piece lives alongside it.

---

## 7. Stage 5 — Distribution

**Where:** Features used from content piece detail; Agent tools

### Email distribution

Send a content piece directly to a list of email recipients via Resend:
- Subject line, HTML or plain text body
- Multiple recipients (comma-separated)
- Delivery tracked in the distribution history: status, recipient count, Resend message ID, sent timestamp

### Export

Download a content piece in the format your CMS or team needs:
- **Markdown** — for Ghost, Notion, Obsidian, or developer CMSs
- **HTML** — ready to paste into any HTML email tool or webpage
- **Plain text** — for universal compatibility

The export is tracked so you can see when a piece was last exported and in what format.

### Webhook / CMS push

Push a content piece to any external system that accepts a POST webhook:
- Content is sent as structured JSON (id, title, contentType, body, excerpt, status, channel, publishedAt)
- Supports any headless CMS (Contentful, Sanity, Strapi, custom APIs)
- Response status and request ID are tracked

### Distribution history

Every distribution event (email, export, webhook) is logged as a `distribution_record` with:
- Channel, status, recipient count
- External reference (Resend message ID, webhook response ID)
- Timestamp
- Error message if the send failed

---

## 8. Stage 6 — Analytics and optimization

**Where:** Tools → Content Analytics; Agent tools

### Logging metrics

After a piece of content is published and distributed, you log its real-world performance. The app is channel-agnostic — you bring the numbers from whatever platform the content ran on:

| Metric | Description |
|--------|-----------|
| Views | Total content views / page views |
| Impressions | Total times the content was shown in a feed |
| Clicks | Total link clicks |
| Engagement | Combined likes + shares + comments + reactions |
| Conversions | Goal completions (sign-ups, purchases, downloads) |
| CTR | Calculated automatically from clicks ÷ impressions |

Metrics are recorded per platform per snapshot. You can log multiple snapshots over time to track a piece as it accumulates performance.

### Performance summary

The Performance Summary view aggregates all logged metrics for a content piece:
- Totals across all platforms
- Average CTR
- Breakdown by platform showing which channel drove the most engagement

### AI performance analysis

The **AI Performance Analysis** button sends the content piece's metrics to the AI which returns:
- **Performance score** (0–100) — a single number representing overall content effectiveness
- **Top insights** — 3 specific observations drawn from the data pattern
- **Recommendations** — 3 actionable steps to improve this content or the next piece like it

### A/B variants

For content that will be tested in multiple versions (e.g. two email subject lines, two ad headlines):
1. Create multiple variants of the content body, labeled A, B, C…
2. Log impressions, clicks, and conversions separately per variant
3. Mark the winning variant when the test concludes

### Closing the loop

The analytics data feeds directly back to Stage 1 and Stage 2:
- Underperforming content reveals gaps in the brand's messaging pillars (update Strategy tab)
- High-performing pieces become proof points for the brand's positioning
- The **Performance Review** agent team can analyze a batch of content, identify patterns, and rewrite underperforming pieces based on what worked

---

## 9. How AI agents accelerate every stage

The AI chat assistant and Agent Teams integrate at every stage of the workflow:

| Stage | What the AI can do |
|-------|-------------------|
| Brand foundation | Auto-generate positioning statements and messaging pillars from a brief description |
| Campaign planning | Research audiences, analyze competitors, write campaign briefs |
| Content production | Write blog posts, newsletters, email sequences, landing pages, social captions |
| Repurposing | Transform any content piece into 7 formats simultaneously |
| Review & governance | Check content against guardrails, rewrite non-compliant sections |
| Distribution | Send emails, trigger webhooks, export files on command |
| Analytics | Log metrics, retrieve performance summaries, run AI analysis |

The agent tools that power this are registered as toggleable capabilities in **Settings → Tools**. Users can enable only what they need and all enabled tools are available in the AI chat by default.

### Agent team templates

Pre-built multi-agent workflows that cover full content marketing sub-tasks:

| Template | What it does |
|----------|-------------|
| Content Pipeline | Research → Draft → Edit in sequence |
| Marketing Campaign | Research → Strategy → Copy → Creative direction |
| Campaign Brief Generator | Market research → Brand strategy → Structured brief |
| Repurposing Engine | Analyze source → Long-form → Social → Email → Ad creative |
| Brand Review | Guardrail check → Compliant rewrite |
| Performance Review | Metrics pull → Insights → Recommendations → Rewrite |

---

## 10. Full user journey walkthrough

This is the complete flow for a solo marketer or small team launching a content campaign from scratch.

### Day 0 — Set up your brand

1. Go to **Settings → Brands → New Brand**
2. Fill in the Profile tab (name, overview, industry, audience)
3. Add tone of voice keywords and brand values in the **Voice & Values** tab
4. Write your positioning statement and messaging pillars in the **Strategy** tab
5. Add ICPs — who you are writing for, what their pain points are, what triggers a purchase
6. Add brand colors and fonts in the **Visual** tab
7. Upload your brand guide PDF in the **Knowledge** tab
8. Add a guardrail rule to block competitor mentions (severity: block)
9. Add a guardrail rule to warn if "engaging tone" is missing from a post (severity: warning)

**Result:** The AI now knows exactly who you are, who you are talking to, and what you should never say.

### Day 1 — Plan the campaign

1. Open **Content Calendar → Campaigns → New Campaign Brief**
2. Enter: title, goal (e.g. "50 newsletter sign-ups"), offer, key message, CTA, channels, dates
3. Link the brief to your brand
4. Switch to the Calendar view, pick dates for the month, and create 8 content entries:
   - 2 long-form blog posts
   - 4 LinkedIn posts
   - 1 email newsletter
   - 1 landing page update
5. Each entry is a production ticket: title, type, planned date, linked to the campaign brief

**Result:** A visual map of what needs to be created, when, and why.

### Week 1 — Produce content

1. Open **Tools → Long-form Content**
2. Select "Blog Post", pick your brand, enter the topic pulled from your campaign brief
3. The AI writes a full SEO-optimized draft in seconds, saved as a content piece
4. Repeat for the newsletter
5. Open **Tools → Repurposing**, paste the blog post ID, select LinkedIn + ad copy outputs
6. The AI generates LinkedIn posts and ad copy derived from the blog, all saved as linked content pieces

Or skip the tool UI entirely and type in chat:
> "Write a blog post about [topic] for the [brand name] campaign using our brand voice. Save it."

**Result:** All 8 planned content pieces exist in the library as drafts.

### Week 1 — Review and approve

1. Open a draft content piece, run **Guardrail Check**
2. Fix any `block` violations, review `warning` flags
3. Submit for approval — assign to the brand manager
4. Brand manager receives an email notification with the content
5. Brand manager logs in, opens the approval queue, adds comments, approves
6. Content piece status automatically moves to `Approved`

**Result:** Every piece has been reviewed against brand standards and signed off by the right person.

### Week 2 — Distribute

1. Open the newsletter content piece
2. Click **Distribute → Email**, add recipients, hit Send — Resend delivers it
3. Open a blog post, click **Distribute → Export → Markdown**, download the file, paste into your CMS
4. For a team using a headless CMS: **Distribute → Webhook**, paste the CMS endpoint URL, send

**Result:** Content is live across all channels without leaving the app.

### Ongoing — Track and improve

1. After each piece has been live for a week, open **Tools → Content Analytics**
2. Enter the content piece ID, click **Log metrics**, enter the numbers from LinkedIn/email/Google Analytics
3. Do this for all 8 pieces
4. Click **AI Performance Analysis** on the two blog posts — the AI returns scores and recommendations
5. The brand manager opens the **Performance Review** agent team:
   > "Analyze all content from the April campaign and identify what worked best. Rewrite the underperforming LinkedIn posts."
6. The team runs automatically: Data Analyst pulls metrics → Content Strategist identifies patterns → Optimizer rewrites the weak posts
7. Repurpose the best-performing blog post into a tweet thread and email for next month's campaign

**Result:** The next campaign brief is written with real performance data. Content quality improves with every cycle.

---

## 11. Feature map

| User need | Feature | Location |
|-----------|---------|---------|
| Define brand voice and rules | Brand editor — Voice & Values tab | Settings → Brands |
| Define target personas | Brand editor — Strategy tab → ICPs | Settings → Brands |
| Upload brand reference documents | Brand editor — Knowledge tab | Settings → Brands |
| Set content rules and compliance checks | Brand editor — Guardrails tab | Settings → Brands |
| Share brand with team | Brand editor — Sharing tab | Settings → Brands |
| Plan a campaign | Campaign Brief | Content Calendar → Campaigns |
| Map content to dates | Monthly calendar | Content Calendar → Calendar |
| Track content status | Kanban board | Content Calendar → Board |
| Write blog posts | Long-form Content tool | Tools → Long-form |
| Write newsletters | Long-form Content tool | Tools → Long-form |
| Write email sequences | Long-form Content tool | Tools → Long-form |
| Write landing pages | Long-form Content tool | Tools → Long-form |
| Repurpose to social / ad / email | Repurposing tool | Tools → Repurposing |
| AI-assisted writing in chat | Chat with tools enabled | Main chat |
| Multi-agent content production | Agent Teams | Agent Teams |
| Check content against brand rules | Guardrail check | Brand Guardrails tool |
| Submit content for approval | Approval request | Collaboration |
| Review and approve content | Approval queue | Collaboration |
| Comment and discuss content | Threaded comments | Collaboration |
| Send content by email | Distribution — Email tab | Distribution panel |
| Export to Markdown / HTML / TXT | Distribution — Export tab | Distribution panel |
| Push to external CMS | Distribution — Webhook tab | Distribution panel |
| Log performance metrics | Metric form | Tools → Content Analytics |
| View performance summary | Performance summary | Tools → Content Analytics |
| AI analysis and recommendations | AI Performance Analysis | Tools → Content Analytics |
| A/B test content variants | A/B Variants | Analytics |
| Automate performance review | Performance Review agent team | Agent Teams |
