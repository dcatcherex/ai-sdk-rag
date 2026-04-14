# Vaja AI — Core Vision Document

> วาจา (Waja) — "word, speech" in Thai

---

## One-Line Definition

**Vaja AI is a skill-first AI cowork platform where any profession can load domain-specific skills into an AI workspace — accessible through LINE OA, with shared credit pools for teams and communities.**

---

## The Problem

AI tools like ChatGPT, Claude, and Gemini have a fundamental access problem in Thailand:

1. **Cost barrier** — Each person must subscribe separately. A family or small team of 5 each paying $20/month = $100/month for what could be shared.
2. **Knowledge barrier** — Generic AI doesn't know your profession. A farmer asking about tomato leaf disease gets a generic answer, not one that accounts for Thai climate, local pesticide availability, or regional market prices.
3. **App barrier** — Thai users live in LINE. Asking them to download another app, create another account, and learn another interface creates friction that loses 80% of potential users before they start.
4. **Complexity barrier** — Choosing AI models, configuring tools, writing prompts — this is invisible work that knowledge workers shouldn't have to do.

---

## The Solution

**Vaja AI removes all four barriers:**

| Barrier | Solution |
|---------|----------|
| Cost | Shared credit pools — one person buys, the group uses |
| Knowledge | Contextual Skills Engine — domain skills load automatically |
| App | LINE OA as the front door — no new app required |
| Complexity | Agent-first — General Assistant is ready on first load, skills activate automatically |

---

## Target Users

Vaja is built for **Thai users who need AI to help them work**, not just chat. Specifically:

**Primary wedge: SME & Solopreneur**
- Small shop owner, freelancer, local service business
- Pain: no marketing team, no content writer, no 24/7 customer support
- Value: AI coworker that handles content, LINE OA replies, and basic business tasks

**Near-term expansion:**
- **Farmers** — pest & disease consultation, weather risk, market prices, farm records
- **Teachers** — lesson planning, exam creation, learning material generation
- **Healthcare workers** — patient communication, report writing, medical information lookup
- **Government officers** — document drafting, regulations lookup, form assistance

**The common thread:** One person wearing 5 hats, time-poor, LINE-native, needing AI that understands their specific work.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     VAJA AI PLATFORM                     │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   Skills Engine  │    │      Agent Workspace        │ │
│  │                 │    │                             │ │
│  │  pest-disease   │───▶│  General Assistant (default)│ │
│  │  lesson-plan    │    │  Custom Agents              │ │
│  │  customer-svc   │    │  Agent Teams                │ │
│  │  farm-records   │    │                             │ │
│  │  [your skill]   │    │  Memory ▪ RAG ▪ Tools       │ │
│  └─────────────────┘    └─────────────────────────────┘ │
│                                      │                   │
│  ┌──────────────────────────────────▼──────────────────┐ │
│  │                  Channel Layer                       │ │
│  │                                                     │ │
│  │    LINE OA (front door)    Web App (control room)   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  Credit System                       │ │
│  │   Individual ▪ Team pool ▪ Organization pool        │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## The Contextual Skills Engine

This is Vaja's core differentiator. Skills are built on the open **Agent Skills standard** (agentskills.io) — the same standard used by Cursor, VS Code, GitHub Copilot, and Claude Code.

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
pest-disease-consult/
├── SKILL.md          ← Instructions: how to diagnose, what to ask, how to respond
├── references/
│   ├── thai-crops.md         ← Common Thai crops and their diseases
│   └── pesticide-guide.md    ← Available products in Thai market
└── assets/
    └── symptom-checklist.md  ← Structured symptom questions
```

### Why This Matters

- **Platform stays general.** Vaja doesn't hardcode farming knowledge in the app. It lives in a skill file that can be updated, replaced, or expanded by anyone.
- **Open standard.** Skills from the global ecosystem (Claude Code, Cursor, GitHub) can work in Vaja. Skills built for Vaja can be shared externally.
- **Community-driven growth.** Thai teachers build education skills. Thai doctors build healthcare skills. A local government officer builds official document skills. Vaja gets better without the core team doing every domain.

---

## LINE OA as the Delivery Channel

For Thai SMEs and rural users, LINE OA is more important than any web feature.

### The Trust Journey

```
Stage 1 — Discovery
  Customer follows a business's LINE OA
  Messages: "เปิดกี่โมง?" (What time do you open?)
  Agent replies correctly → "This is useful"

Stage 2 — Trust Building
  Customer asks product questions, gets helpful answers
  Agent uses customer-service skill automatically
  → "This is better than the old auto-reply"

Stage 3 — Delegation
  Business owner lets agent handle FAQs autonomously
  Reviews logs weekly on web app
  → "I saved 2 hours this week"

Stage 4 — Expansion
  Adds more skills (promotion generator, complaint handler)
  Links LINE OA to content calendar
  → "Vaja is my marketing assistant"
```

### Rich Menu = Skill Selector

The LINE OA rich menu (the button grid at the bottom of chat) maps directly to agent selection — which determines which skills are active. A farmer's LINE OA might have:
- "ถามเรื่องโรคพืช" → loads pest-disease-consult skill
- "เช็คราคาตลาด" → loads market-price skill
- "บันทึกฟาร์ม" → loads farm-record-keeper skill

---

## Revenue Model

### Credit System

Credits are consumed by AI usage. Different models cost different amounts.

### Pricing Tiers (proposed)

| Pack | Credits | Price | Per credit |
|------|---------|-------|------------|
| Starter | 100 | 99 ฿ | 0.99 ฿ |
| Standard | 500 | 399 ฿ | 0.80 ฿ |
| Pro | 2,000 | 1,299 ฿ | 0.65 ฿ |
| Team | 5,000 | 2,999 ฿ | 0.60 ฿ |

Volume discount incentivizes larger purchases. Team packs allow credit distribution to members.

### Subscription Plans (future)

Monthly fee with included credits for predictable revenue:
- **Solo** 199 ฿/mo → 150 credits
- **Team** 699 ฿/mo → 600 credits shared among up to 5 members
- **Organization** custom → credit pool distributed to departments

### Skills Marketplace (long-term)

- **Free skills**: Community-contributed, open standard
- **Premium skills**: Creator-priced, Vaja takes 20-30%
- **Verified skills**: Professionally reviewed (healthcare-grade, legal-grade compliance)

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

**Design principle:** Autonomy is earned per task type, not globally. Users graduate levels as trust builds. The platform is currently strongest at Levels 1-3.

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
| Channel | One interface | Web + LINE OA |
| Sharing | Solo | Team/family/community |

---

## Roadmap

### Phase 1 — Foundation (current)
- [x] Multi-model AI chat (20+ models)
- [x] Agent builder with custom personas
- [x] Contextual Skills Engine (create, import, attach, activate)
- [x] LINE OA integration (webhook, rich menu, broadcast)
- [x] Credit system + sharing
- [x] RAG/Knowledge base
- [x] Agent Teams (multi-agent orchestration)
- [x] Content marketing + calendar + distribution
- [ ] Skills Marketplace (community gallery — basic UI exists)

### Phase 2 — Skills Ecosystem
- [ ] Agriculture skill pack (for AgriSpark demo + Thai farmers)
- [ ] Education skill pack (lesson plan, exam creator, material generator)
- [ ] Healthcare skill pack (patient comms, report writing, drug lookup)
- [ ] Skill sync checking (update from GitHub source)
- [ ] Skill ratings and reviews in community gallery

### Phase 3 — LINE-Native Experience
- [ ] LINE OA approval flows (approve content drafts via LINE itself)
- [ ] LINE push notifications for agent activity
- [ ] Voice interface improvement for Thai language

### Phase 4 — Organization & Monetization
- [ ] Organization credit pools (school/hospital/company admin dashboard)
- [ ] Subscription plans
- [ ] Skills Marketplace with revenue sharing
- [ ] Developer API for external skill publishing

### Phase 5 — Platform Openness
- [ ] Public developer documentation
- [ ] SDK for skill creation
- [ ] Partner integrations (agricultural databases, Thai government APIs, health registries)

---

## Key Differentiators vs Competitors

| | ChatGPT | Claude | Gemini | Vaja AI |
|---|---|---|---|---|
| Thai LINE OA | ❌ | ❌ | ❌ | ✅ |
| Credit sharing | ❌ | ❌ | ❌ | ✅ |
| Domain skills | ❌ | ❌ | ❌ | ✅ |
| Open skill standard | ❌ | ❌ | ❌ | ✅ |
| Multi-model | ❌ | ❌ | ❌ | ✅ |
| Thai-first UX | ❌ | ❌ | ❌ | ✅ |
| No app install needed | ❌ | ❌ | ❌ | ✅ (LINE) |

---

*Last updated: April 2026*
*This document describes the product vision and direction — not necessarily the current implemented state.*
