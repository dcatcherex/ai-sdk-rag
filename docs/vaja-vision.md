# Vaja AI — Core Vision Document

> วาจา (Waja) — Thai for utterance, spoken words, or speech: ถ้อยคำ, คำกล่าว, คำพูด. It carries a sense of how words are used, as in วาจาสุภาพ, วาจาอ่อนหวาน, and วาจาสัตย์.

---

## One-Line Definition

**Vaja AI is a skill-first AI cowork platform where any profession can load domain-specific skills into an AI workspace — accessible through a web control room, public shared web chat links, and LINE OA, with shared credit pools for teams and communities.**

---

## Operating Reality (read this first)

Vaja is built and operated by **one full-time developer**. Every decision in this
document is filtered through that constraint:

- Every shipped feature is a **permanent maintenance tax**. Breadth is the #1 risk.
- The near-term goal is **first paying customers within 6 months** (by January 2027),
  not feature completeness.
- Distribution comes from **warm access**: SME shop owners and teachers the founder
  can talk to this month — not cold marketing.
- Domain knowledge must live in **skill files**, never in platform code, so one
  person can serve many professions without becoming an expert in each.

Anything in this document that conflicts with these constraints loses.

---

## Current Status — July 2026

What is actually live (kept honest, updated monthly):

- ✅ Multi-model AI chat, agent builder, Contextual Skills Engine (create / import from GitHub / attach / rule + model activation)
- ✅ LINE OA integration: webhook, rich menus, broadcast, account linking, analytics
- ✅ **Payments: PromptPay QR top-up with slip verification inside LINE** (`features/line-oa/payment/`)
- ✅ Public shared web agent links (guest chat, owner-funded credits, limits, analytics)
- ✅ Credit system + credit sharing
- ✅ RAG / knowledge base, long-term memory, voice (transcription + real-time)
- 🗑️ Agent teams, content suite, teacher tools, Google Workspace, media/web builders, AgriSpark tools — **scheduled for deletion** (Sep 2026 compaction, see Scope Discipline)
- ⏳ Real usage: a handful of informal testers; no paying customers yet
- ❌ Not started: marketplace revenue sharing, org credit pools, developer API/SDK

---

## The Problem

AI tools like ChatGPT, Claude, and Gemini have a fundamental access problem in Thailand:

1. **Cost barrier** — Each person must subscribe separately. A family or small team of 5 each paying $20/month = $100/month for what could be shared.
2. **Knowledge barrier** — Generic AI doesn't know your profession. A farmer asking about tomato leaf disease gets a generic answer, not one that accounts for Thai climate, local pesticide availability, or regional market prices.
3. **Access barrier** — Thai users live in LINE, while owners and teams still need a web control room, and many first interactions happen through links from Facebook, TikTok, websites, QR codes, classrooms, clinics, or events. Customers, students, or community members should be able to use an agent from a simple shared web chat link or LINE OA without installing another app or creating a full account.
4. **Complexity barrier** — Choosing AI models, configuring tools, writing prompts — this is invisible work that knowledge workers shouldn't have to do.

---

## The Solution

**Vaja AI removes all four barriers:**

| Barrier | Solution |
|---------|----------|
| Cost | Shared credit pools — one person buys, the group uses |
| Knowledge | Contextual Skills Engine — domain skills load automatically |
| Access | Web control room for work, shared web chat links for no-account guests, LINE OA for no-install daily conversations |
| Complexity | **Template agents** — pick a pre-built agent for your profession, answer a few questions, done in 10 minutes |

Note the complexity solution: the target user never authors a SKILL.md or configures
an agent from scratch. The skills engine is first an **internal authoring tool** —
Vaja ships ready-made template agents with skills preloaded. User-facing skill
authoring and a marketplace come only after demand proves out.

---

## Target Users & Wedge Order

The common thread: one person wearing 5 hats, time-poor, mobile-first, LINE-native,
needing AI that understands their specific work.

**Wedge #1 — SME shop owner with a LINE OA** *(revenue track, now)*
- Small shop, freelancer, local service business already replying to customers on LINE
- Pain: no marketing team, no content writer, no 24/7 customer support
- Why first: the entire stack for this customer is already built — LINE webhook,
  rich menus, broadcast, and in-LINE PromptPay top-up. They already pay for business
  tools with their own money, and the founder has warm access to them.

**Wedge #2 — Teachers** *(second track, after first paid shop owners)*
- Lesson planning, exam creation, learning material generation (exam builder and
  quiz tooling partially exist)
- Sell to **individual teachers as credit packs**, not to schools — institutional
  procurement is too slow for a solo founder.

**Demo track — Farmers / agriculture** *(AgriSpark competition, not a revenue bet)*
- Pest & disease consultation, market prices, farm records
- Rides on the same template-agent machinery; graduates to a revenue track only if
  the competition produces real distribution.

**Deferred — Healthcare workers, government officers**
- Compliance-heavy (PDPA, medical-information liability, procurement). Phase 4+ at
  the earliest. These segments must not shape near-term decisions.

---

## Scope Discipline (solo operating constraints)

**Lesson from July–Sep 2026:** a "maintenance-only" bucket did not stop scope
growth — the codebase reached ~183k lines across 52 feature modules, most of them
outside the wedge. Kept code still costs type-checks, migrations, tool-registry
wiring, and every Next.js / AI SDK upgrade. So there are now only two buckets:
**Keep** or **Delete**. Deleted code lives in git history (tag
`pre-compaction-2026-09`); anything can come back when a paying customer asks.

**Rules**
- No new module without a paying customer (or a signed pilot) asking for it.
- Domain features become **skills**, not modules. If it can be a SKILL.md plus
  chat, it must be.
- Delete, don't hide. Tables are dropped in a single later migration once the
  code removal is stable.

### Keep — the core (Sep 2026 compaction)

| Area | Modules |
|------|---------|
| Chat runtime | `chat`, `agents` (incl. conversation-turn runtime), `models` (admin-only page) |
| Skills Engine | `skills` |
| LINE OA + payments | `line-oa` (minus AgriSpark farm-records handlers) |
| LINE / channel rendering | `task-flows`, `response-format`, `rich-messages` — kept, simplify after cuts |
| Shared web links | guest / public share (in `agents`) |
| Credits + top-up | credits, `line-oa/payment` |
| Knowledge | RAG / knowledge base, `memory` |
| Media | `image`, `gallery`, `external-tools` (KIE provider for image gen only) |
| Voice | transcription (LINE voice messages) |
| Brand | `brands` — slimmed to brand voice + logo for promo copy |
| Operator | `admin`, `settings`, `auth`, `ai-config`, `tools` (registry), `workspace` (catalog/prefs), `layout` |

### Delete — in this order (one PR per batch)

| # | Batch | Modules | Why |
|---|-------|---------|-----|
| 1 | AgriSpark | `crop-price`, `record-keeper`, `line-oa/webhook/events/farm-records.ts` | Competition finished; farm knowledge → skill |
| 2 | Google Workspace | `google-docs`, `google-sheets`, `google-slides`, `google-drive`, `google-workspace` | No wedge demand; OAuth scope burden |
| 3 | Media & web | `video`, `audio`, `speech`, `website-builder`, `deploy` (+ their `external-tools` providers) | Not part of shop-owner job |
| 4 | Teacher tools | `quiz`, `certificate`, `exam-builder` | Teachers deferred; rebuild as a skill later |
| 5 | Content suite | `content-marketing`, `content-calendar`, `content-hub`, `distribution`, `repurposing`, `long-form`, `collaboration`, `brand-guardrails`, `brand-photos`, `analytics` (content metrics) | Promotion = promotion skill + image gen + LINE broadcast |
| 6 | Agent teams | `agent-teams` | Autonomy scope is Levels 1–3; one good agent per shop |
| 7 | Workspace modules | `case-workspace`, `user-tools`, `workspace-ai`, `platform-agent`, `prompts` | Generic-professional surface; concierge onboarding replaces platform agent |
| 8 | Domain profiles | `domain-profiles` | Coupled into core (13 imports) — separate careful PR |
| 9 | Real-time voice | Gemini Live voice (`use-live-voice`, `live-token`, `realtime`, `voice-turn`) | Costly, fast-moving API; revive only if a shop owner asks |
| 10 | Schema cleanup | Drop tables for batches 1–9 | After code removal has been stable in production |

**Not now — do not build**
- Skills marketplace with revenue sharing, verified/premium skills
- Organization credit pools and admin dashboards
- Developer API, skill-creation SDK, partner integrations
- Agent autonomy Levels 4–5 (see Autonomy Model)

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     VAJA AI PLATFORM                     │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   Skills Engine  │    │      Agent Workspace        │ │
│  │                 │    │                             │ │
│  │  customer-svc   │───▶│  Template Agents (default)  │ │
│  │  promotion-gen  │    │  Custom Agents              │ │
│  │  lesson-plan    │    │                             │ │
│  │  exam-builder   │    │                             │ │
│  │  [your skill]   │    │  Memory ▪ RAG ▪ Tools       │ │
│  └─────────────────┘    └─────────────────────────────┘ │
│                                      │                   │
│  ┌──────────────────────────────────▼──────────────────┐ │
│  │                  Channel Layer                       │ │
│  │                                                     │ │
│  │   Web Chat     Shared Web Links     LINE OA          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Credit System + PromptPay Top-up           │ │
│  │   Individual ▪ Team pool ▪ (Org pool — later)       │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## The Contextual Skills Engine

This is Vaja's core differentiator and the founder's leverage: the platform stays
small and general while domain expertise scales through files. Skills are built on
the open **Agent Skills standard** (agentskills.io) — the same standard used by
Cursor, VS Code, GitHub Copilot, and Claude Code.

### How It Works

```
User message arrives
        ↓
Skills Engine scans attached skills
        ├─ Rule-based activation: /command or keyword match → immediate
        └─ Model-based activation: LLM scores skill relevance → top 2 auto-activate
                ↓
Active skill's knowledge injected into AI context (3 tiers):
  1. Catalog    — all available skills listed for the LLM
  2. Active     — full instructions from triggered skills
  3. Resources  — relevant reference files (docs, tables, templates)
        ↓
AI responds with domain expertise it didn't have before
```

### What a Skill Looks Like

```
customer-service-shop/
├── SKILL.md          ← Instructions: tone, FAQ handling, escalation rules
├── references/
│   ├── store-policies.md      ← Opening hours, delivery, returns
│   └── product-catalog.md     ← What the shop sells
└── assets/
    └── promotion-templates.md ← Reusable promo message formats
```

### Why This Matters

- **Platform stays general.** Domain knowledge lives in skill files that can be
  updated, replaced, or expanded without touching application code.
- **Open standard.** Skills from the global ecosystem (Claude Code, Cursor, GitHub)
  can work in Vaja, and Vaja skills can be shared externally.
- **Community-driven growth — eventually.** Thai teachers building education skills
  and doctors building healthcare skills is the long-term flywheel. Near-term, the
  founder authors the skills behind each template agent.

---

## Channel Strategy: Web, Shared Web, and LINE OA

Vaja is one agent runtime exposed through the right channel for the job:

| Channel | Primary user | Role |
|---------|--------------|------|
| Web chat | Owner, team member, power user | The control room for building agents, attaching skills, managing knowledge, reviewing work |
| Shared web chat link | Customer, student, community member | The fastest no-account doorway to one specific agent, with owner-funded credits, limits, and analytics |
| LINE OA | Thai customer or field user | The no-install daily conversation surface where people already message businesses |

Shared web chat is the lowest-friction discovery path: click a link, scan a QR code,
ask the agent. LINE OA is the strongest repeat-use path in Thailand. The web app is
the owner's control room.

**Guardrail:** because shared links spend the *owner's* credits, server-side
per-link rate limits and spend caps are a launch prerequisite for promoting links
publicly — not an optional feature.

### Discovery and Trust Journey

```
Stage 1 — Discovery
  Customer opens a shared web chat link or follows a business's LINE OA
  Messages: "เปิดกี่โมง?" (What time do you open?)
  Agent replies correctly → "This is useful"

Stage 2 — Trust Building
  Customer asks product questions from the shared link or LINE chat
  Agent uses customer-service skill automatically
  → "This is better than the old auto-reply"

Stage 3 — Delegation
  Business owner lets agent handle FAQs autonomously
  Reviews logs weekly on web app
  → "I saved 2 hours this week"

Stage 4 — Expansion
  Adds more skills (promotion generator, complaint handler)
  Shares agents through links, QR codes, and LINE OA
  → "Vaja is my marketing assistant"
```

### Rich Menu = Skill Selector

The LINE OA rich menu maps directly to agent selection — which determines which
skills are active. A shop's LINE OA might have:
- "สอบถามสินค้า" → customer-service agent
- "โปรโมชั่น" → promotion agent
- "ติดต่อร้าน" → escalation to owner

---

## Go-to-Market: Concierge First

How the first 10 customers happen. This is a phase of the product, not an
afterthought.

1. **Founder-led onboarding.** The founder personally sets up each pilot: connects
   the LINE OA, picks the template agent, fills in the shop's knowledge (hours,
   products, policies), and tests it with the owner sitting there.
2. **Charge from day one.** Even the 99฿ Starter pack. Free pilots don't validate
   willingness to pay; a small payment does.
3. **Weekly check-ins** with each pilot become the product feedback loop and the
   source of testimonials and referrals.
4. **Referral through the product itself:** every shared link and LINE agent is a
   demo another shop owner can experience before buying.
5. Self-serve onboarding gets built only after concierge onboarding has been done
   ten times and the repeated steps are known.

**Success metrics and kill criteria:**

| Milestone | Target date | If missed |
|-----------|------------|-----------|
| 3 businesses using their agent weekly | Sep 2026 | Fix onboarding or switch template |
| First paid top-up | Oct 2026 | Re-examine pricing / value prop with pilots |
| 10 paying customers | Jan 2027 | Change wedge (teachers first) or product shape |

---

## Revenue Model

### Credit System

Credits are consumed by AI usage. Different models cost different amounts.
Top-up already works end-to-end inside LINE via PromptPay QR + slip verification.

**Unit-economics rule:** before any pricing change or new model is enabled for
customers, compute the real LLM cost of a typical conversation turn per model and
confirm ≥50% gross margin per credit. Shared links spend owner-funded credits, so
margin math must include guest traffic.

### Pricing Tiers (live)

| Pack | Credits | Price | Per credit |
|------|---------|-------|------------|
| Starter | 100 | 99 ฿ | 0.99 ฿ |
| Standard | 500 | 399 ฿ | 0.80 ฿ |
| Pro | 2,000 | 1,299 ฿ | 0.65 ฿ |
| Team | 5,000 | 2,999 ฿ | 0.60 ฿ |

Volume discount incentivizes larger purchases. Team packs allow credit distribution to members.

### Subscription Plans (after 10 paying customers)

Monthly fee with included credits for predictable revenue:
- **Solo** 199 ฿/mo → 150 credits
- **Team** 699 ฿/mo → 600 credits shared among up to 5 members

### Skills Marketplace (long-term — Not Now bucket)

- **Free skills**: community-contributed, open standard
- **Premium skills**: creator-priced, Vaja takes 20–30%
- **Verified skills**: professionally reviewed (healthcare-grade, legal-grade)

Built only when there is organic demand from skill creators — not before.

---

## Agent Autonomy Model

Not all tasks need the same level of human oversight. Vaja uses a 5-level model:

| Level | Name | Description | Example |
|-------|------|-------------|---------|
| 1 | On-demand | User asks, agent responds once | "Write a caption for this photo" |
| 2 | Supervised | Agent drafts, human approves before action | Agent drafts 7 LINE posts, user reviews and schedules |
| 3 | Monitored | Agent acts, human gets notified, can intervene | Agent auto-replies to FAQs, log visible to owner |
| 4 | Delegated | Agent owns task end-to-end, reports outcomes | Weekly analytics summary sent automatically |
| 5 | Autonomous | Agent operates independently, escalates edge cases | Agent manages LINE OA 24/7, pings for unusual cases |

**Design principle:** autonomy is earned per task type, not globally.
**Scope decision:** Vaja targets Levels 1–3 only. Level 3 — the agent auto-replying
on LINE while the owner reviews logs weekly — *is* the product for a shop owner.
Levels 4–5 are explicitly out of scope until well after first revenue.

---

## What Makes Vaja "Agent-First"

Traditional AI apps: you interact with a model.
Vaja: you collaborate with agents that have roles, memory, and skills.

| Dimension | Traditional AI | Vaja Agent |
|-----------|---------------|------------|
| Knowledge | Generic | Loaded with your domain skills |
| Memory | Per-session | Long-term memory of your business |
| Persona | Fixed | Your brand voice and tone |
| Presence | Reactive (you ask) | Proactive (it suggests) |
| Channel | One interface | Web chat + shared web links + LINE OA |
| Sharing | Solo | Team/family/community |

---

## Competition — honest view

The real competitive set is not ChatGPT's chat window:

| Competitor class | What they offer | Vaja's durable edge |
|------------------|----------------|---------------------|
| Thai LINE chatbot SaaS (rich-menu / broadcast / CRM tools) | LINE-native automation, established sales channels | Real LLM agents with domain skills and memory, not decision-tree bots; credit pooling |
| OpenAI GPTs / Claude Projects | Domain-customized agents, shareable links | LINE OA as a channel, in-LINE PromptPay payment, shared credit pools, Thai-first UX, open skill standard portable across ecosystems |
| ChatGPT / Claude / Gemini apps | Best raw models, huge budgets | No LINE presence, per-seat pricing that groups can't share, no Thai SME distribution |

The moat is the **combination**: LINE-native agent + payments in the chat + credits
one person buys for a group + skills on an open standard. No single row above is
defensible alone.

---

## Operations & Compliance (prerequisites for charging)

Cheap versions are acceptable; absence is not.

- **Monitoring & alerting** — error tracking (e.g., Sentry) with alerts to the
  founder's own LINE; a solo operator needs to be paged, not to watch dashboards.
- **Backups** — Neon point-in-time recovery verified; R2 assets are re-generable or
  backed up.
- **Legal pages** — Terms of Service, Privacy Policy, and PDPA-compliant data
  handling notice in Thai, before the first paid customer.
- **Support channel** — a Vaja LINE OA (dogfooding the product) as the support
  front door, with the founder behind it.
- **Abuse controls** — server-side rate limits and spend caps on shared links and
  LINE webhooks.

---

## Roadmap

### Phase 1 — Foundation ✅ (done)
Multi-model chat, agent builder, Skills Engine, LINE OA integration, credits +
PromptPay top-up, RAG, shared web links, voice, agent teams, content suite.

### Phase 1.5 — First Revenue (now → Jan 2027) ★ current focus
- [ ] Codebase compaction: delete batches 1–10 (see Scope Discipline)
- [ ] Shop-owner template agent (customer-service + promotion skills preloaded)
- [ ] 10-minute onboarding: connect LINE OA → pick template → answer 5 questions
- [ ] Server-side rate limits and spend caps on shared links
- [ ] Unit-economics audit: cost per credit per model, margin ≥50%
- [ ] Terms / Privacy / PDPA pages (Thai), monitoring + alerting, support LINE OA
- [ ] 5 concierge pilots from warm network → convert to paid top-ups
- [ ] Teacher template agent (exam + lesson-plan skills) as track two

### Phase 2 — Skills Ecosystem (after 10 paying customers)
- [ ] Education skill pack expansion
- [ ] Agriculture skill pack (AgriSpark demo rides here)
- [ ] Skill sync checking (update from GitHub source)
- [ ] Skill ratings and reviews in community gallery

### Phase 3 — LINE-Native and Shared-Web Experience
- [ ] LINE OA approval flows (approve content drafts via LINE itself)
- [ ] LINE push notifications for agent activity
- [ ] Voice interface improvement for Thai language
- [ ] Shared web link polish: branded landing pages, lead capture, guest analytics

### Phase 4 — Organization & Monetization
- [ ] Subscription plans
- [ ] Organization credit pools (school/company admin dashboard)
- [ ] Skills Marketplace with revenue sharing
- [ ] Healthcare / government segments (compliance work starts here, not earlier)

### Phase 5 — Platform Openness
- [ ] Public developer documentation, SDK for skill creation
- [ ] Partner integrations (agricultural databases, Thai government APIs)

---

*Last updated: September 2026 (scope compaction)*
*The "Current Status" section is kept honest and updated monthly. Everything else
describes direction, filtered through the solo operating constraints at the top.*
