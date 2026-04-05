# CLAUDE.md — AI Coder Implementation Guide

This file is read automatically by Claude Code at the start of every session.
It describes how to work in this codebase — conventions, critical rules, and how the pieces fit together.

---

## Product Overview

**Vaja AI** (วาจา — "word/speech") is a **skill-first, agent-first AI cowork platform** for Thai users.

The core idea: any profession can load domain-specific skills into an AI workspace and get an AI coworker that truly understands their work — accessible through LINE OA (no new app required) and a web control room, with shared credit pools so teams and communities can use AI together affordably.

See `docs/vaja-vision.md` for the full product vision.

---

## Package Manager

**Always use `pnpm`.** The project has `pnpm-lock.yaml` as the lock file.
Using `npm` or `bun` moves packages to `node_modules/.ignored` and breaks the build.

```bash
pnpm install          # install dependencies
pnpm dev              # start dev server (Turbopack)
pnpm build            # production build
pnpm exec tsc --noEmit  # type-check without compiling
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.9 |
| Auth | Better Auth + Magic Link + Google OAuth | 1.4 |
| Database | Neon (serverless Postgres) + Drizzle ORM | 0.45 |
| AI | Vercel AI SDK + @ai-sdk/openai | 6.0 |
| UI | React 19 + shadcn/ui + Tailwind CSS v4 | — |
| State | TanStack Query v5 | 5.90 |
| Vector store | pgvector (via Drizzle) | — |
| File storage | Cloudflare R2 (S3-compatible) | — |
| Email | Resend | 6.9 |
| Icons | Lucide React | 0.563 |
| Validation | Zod | 4.3 |

---

## Directory Structure

```
app/                          # Next.js App Router pages & API routes
  (main)/                     # Main app layout group
    agents/                   # Agent builder page
    agent-teams/              # Multi-agent team builder
    content/                  # Content Hub dashboard
    content-calendar/         # Campaign & content calendar
    gallery/                  # Media gallery
    knowledge/                # Knowledge base (RAG)
    line-oa/                  # LINE OA management
    models/                   # AI models table
    settings/                 # User settings
    skills/                   # Skills library
    tools/[toolSlug]/         # Dynamic tool pages
  api/
    chat/route.ts             # Main AI chat endpoint — do not refactor lightly
    agents/                   # Agent CRUD
    agent-teams/              # Team CRUD + runs
    analytics/                # Content metrics + A/B testing
    content-pieces/           # Content CRUD
    content-calendar/         # Calendar + campaign APIs
    distribution/             # Multi-channel distribution
      email/
      line-broadcast/
      export/
      webhook/
    line-oa/                  # LINE OA management APIs
    line/                     # LINE webhook handler
    skills/                   # Skills CRUD + import + install
    tools/                    # Tool execution APIs

features/                     # Domain feature modules (preferred location for new code)
  chat/                       # Chat UI, hooks, server utilities
    components/
      chat-sidebar.tsx        # Root sidebar component
      sidebar/
        sidebar-nav.tsx       # Nav items (OPTIONAL_NAV_ITEMS)
    hooks/
      use-chat-session.ts     # Core chat state
      use-threads.ts          # Thread CRUD
      use-live-voice.ts       # Gemini Live API voice streaming
    server/
      schema.ts               # Zod request/response schemas
      routing.ts              # Model routing logic
      persistence.ts          # DB save operations

  skills/                     # ★ CORE FEATURE — Contextual Skills Engine
    service.ts                # Trigger detection, model scoring, resource loading
    types.ts                  # Skill, SkillTriggerType, SkillActivationMode
    hooks/use-skills.ts       # React Query hooks
    components/
      skills-list.tsx         # My Skills + Community tabs
      skill-form-dialog.tsx   # Create/edit skill form
    server/
      package-import.ts       # GitHub SKILL.md fetching + file classification

  agents/                     # Custom agent builder
  agent-teams/                # Multi-agent orchestration
    components/               # Team builder UI, team chat interface

  line-oa/                    # LINE Official Account integration
    analytics.ts              # Daily metrics aggregation
    broadcast/service.ts      # Broadcast/narrowcast messaging
    link/service.ts           # Account linking (LINE ↔ app user)
    metrics-tools.ts          # Analytics AI tools
    notifications/            # Push notification service
    webhook/                  # LINE webhook event handlers
      events/message.ts
      events/postback.ts
      rich-menu/builder.ts
    components/
      rich-menu-editor.tsx    # Visual rich menu builder

  content-marketing/          # Content creation + performance
    line-tools.ts             # LINE-specific content tools
  content-calendar/           # Campaign briefs + calendar
    line-tools.ts
  content-hub/                # Aggregation dashboard (in progress)
  distribution/               # Multi-channel content delivery
    components/distribution-panel.tsx
    hooks/use-distribution.ts
  collaboration/              # Workspace, approvals, comments, brand guardrails
    service.ts

  tools/                      # Tool registry
    registry/
      types.ts                # ToolManifest, ToolExecutionResult
      client.ts               # Client-safe registry (manifests only)
      server.ts               # Server registry (imports agent adapters)
  quiz/                       # Quiz/Exam Prep tool
  certificate/                # Certificate Generator tool
  gallery/
  models/
  settings/
  brands/                     # Brand management

lib/                          # Shared utilities and services
  ai.ts                       # availableModels, chatModel, ModelOption type
  db.ts                       # Drizzle + Neon connection
  auth.ts                     # Better Auth setup
  prompt.ts                   # System prompts (10 persona types)
  credits.ts                  # Credit system
  memory.ts                   # User memory extraction/injection
  tools/
    index.ts                  # buildToolSet() — assembles agent tool set
    rag.ts                    # RAG/knowledge search tools
    weather.ts                # Weather tools
  certificate-service.ts      # Certificate business logic (622 lines)
  certificate-generator.ts    # PDF/PNG generation
  vector-store.ts             # pgvector search
  rag-tool.ts                 # Knowledge base AI SDK tools

db/
  schema/                     # Drizzle table definitions — split by domain
    agents.ts
    agent-teams.ts
    analytics.ts
    auth.ts
    brands.ts
    certificates.ts
    chat.ts
    collaboration.ts
    content.ts
    credits.ts
    documents.ts
    line-oa.ts
    planning.ts
    skills.ts                 # agentSkill, skillSource, agentSkillFile, agentSkillAttachment
    social.ts
    tools.ts
    users.ts
  migrations/                 # SQL migration files (0001–0039+)

components/
  ui/                         # shadcn/ui primitives — do not modify
  message-renderer/           # Chat message rendering
  ai-elements/                # AI-specific UI components

documents/                    # Reference docs for AI coders
  agent-skill/                # Open Agent Skills standard (agentskills.io)
  google/live_api/            # Gemini Live API docs
```

---

## Critical Rules

### 1. Tool Architecture — The One Rule

> Every tool must have one canonical `service.ts`.
> Agent adapter, API route, and sidebar page all call that service.

```
Sidebar → POST /api/tools/[slug]/run → service.ts
Agent   → agent.ts (thin wrapper)  → service.ts
```

**Never duplicate logic** between the agent adapter and a sidebar/API route.

### 2. Tool Registry Split

| File | What it imports | Where it's used |
|------|----------------|----------------|
| `features/tools/registry/client.ts` | Manifests only | Sidebar, settings, client components |
| `features/tools/registry/server.ts` | Manifests + agent adapters | API routes, chat route |

**Never import `service.ts` or `agent.ts` in client components.**

### 3. Adding a New Tool — Checklist

```
1. features/<toolName>/manifest.ts        ← id, slug, title, icon, category, defaultEnabled
2. features/<toolName>/schema.ts          ← Zod input/output schemas
3. features/<toolName>/service.ts         ← canonical business logic
                                             runXxx()      ← raw (used by agent adapter)
                                             xxxAction()   ← returns ToolExecutionResult
4. features/<toolName>/agent.ts           ← thin tool() wrappers calling runXxx()
5. features/<toolName>/types.ts           ← exported TypeScript types
6. Register in features/tools/registry/client.ts
7. Register in features/tools/registry/server.ts
8. Register in features/tools/registry/page-loaders.ts
9. Create features/<toolName>/components/<tool>-tool-page.tsx
```

### 4. Adding a New Skill (SKILL.md format)

Skills follow the open Agent Skills standard (see `documents/agent-skill/`).

```
features/skills/ or a GitHub repo:
  my-skill/
    SKILL.md          ← Required: YAML frontmatter (name, description) + instructions
    scripts/          ← Optional: executable code
    references/       ← Optional: domain knowledge docs
    assets/           ← Optional: templates, data files
```

SKILL.md frontmatter minimum:
```yaml
---
name: skill-name          # lowercase, hyphens only, max 64 chars
description: What this skill does and when to activate it. Max 1024 chars.
---
```

Skills can be created inline in the UI or imported from any public GitHub URL.

### 5. Database Changes

Schema is split across `db/schema/*.ts` files by domain. Import the right file.

After modifying any schema file:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 6. Imports

Use `@/` alias for all imports (maps to project root).

```typescript
// Correct
import { db } from '@/lib/db';
import { agentSkill } from '@/db/schema/skills';

// Wrong
import { db } from '../../../lib/db';
```

---

## Skills System (Contextual Skills Engine)

This is the **core differentiator** of Vaja AI. Read this section carefully.

### What a Skill Does

A skill injects specialized knowledge into the AI's system prompt when it detects a relevant task. The AI gains domain expertise on demand without any user action.

### Three-Tier Injection in Chat

When a message arrives at `app/api/chat/route.ts`:

```
Tier 1 — Catalog (available_skills tag)
  All model-discoverable skills are listed by name + description.
  The LLM sees what's available even if not yet activated.

Tier 2 — Active Skills (active_skills tag)
  Skills triggered by rule (slash/keyword/always) AND model-discovered skills.
  Full promptFragment content injected here.

Tier 3 — Skill Resources (skill_resources tag)
  Bundled reference files from activated skills (references/, assets/).
  Max 2 files per skill, matched by relevance to user message.
```

### Trigger Types

| Type | When activates |
|------|---------------|
| `always` | Every message when skill is attached to active agent |
| `slash` | User types `/command-name` |
| `keyword` | User message contains keyword (case-insensitive) |

### Activation Modes

| Mode | How discovered |
|------|---------------|
| `rule` | Only explicit triggers (slash/keyword/always) |
| `model` | LLM scores skill relevance against message tokens, top 2 auto-activated |

### Key Files

| File | Purpose |
|------|---------|
| `features/skills/service.ts` | `detectTriggeredSkills()`, `selectModelDiscoveredSkills()`, `getRelevantSkillResourcesForPrompt()` |
| `features/skills/server/package-import.ts` | GitHub SKILL.md fetching and file parsing |
| `db/schema/skills.ts` | 4 tables: `agentSkill`, `skillSource`, `agentSkillFile`, `agentSkillAttachment` |
| `app/api/chat/route.ts` (lines 139–281) | Where skills are fetched, triggered, and injected |
| `app/api/skills/` | CRUD, import from GitHub, install community skill |

### Database Tables (Skills)

| Table | Purpose |
|-------|---------|
| `agentSkill` | Skill definition: name, description, promptFragment, triggerType, activationMode, enabledTools |
| `skillSource` | Deduped GitHub sources (owner/repo/ref/path) |
| `agentSkillFile` | Bundled files from imported packages (SKILL.md, references, assets, scripts) |
| `agentSkillAttachment` | Junction: agent ↔ skill with per-agent overrides and priority |

---

## AI Chat Route (`app/api/chat/route.ts`)

```
Stage 1  — auth + body parse (parallel)
Stage 2  — DB queries: user, thread, prefs, balance, agent, persona (parallel)
Stage 3  — memory context + persona detection (parallel)
Stage 4  — load agent skills → detect triggers → model discovery
Stage 5  — build system prompt (agent > custom persona > detected persona)
           + inject skill catalog, active skills, skill resources
Stage 6  — buildToolSet() with user's enabled tool IDs + skill-unlocked tools
Stage 7  — streamText() or generateImage() based on model capabilities
Stage 8  — on finish: persist messages, token usage, follow-up suggestions, memory extraction
```

Key functions:
- `buildToolSet()` — `lib/tools/index.ts`
- `getSystemPrompt()` — `lib/prompt.ts`
- `detectPersona()` — `lib/persona-detection.ts`
- `extractMemory()` — `lib/memory.ts`
- `getModelByIntent()` — `features/chat/server/routing.ts`
- `saveMessages()` — `features/chat/server/persistence.ts`
- `getSkillsForAgent()` — `features/skills/service.ts`
- `detectTriggeredSkills()` — `features/skills/service.ts`
- `selectModelDiscoveredSkills()` — `features/skills/service.ts`

---

## LINE OA Integration

LINE is the primary communication channel for Thai users (54M users). Vaja treats LINE OA as the **front door** for end users, and the web app as the **control room**.

### Architecture

```
Customer messages LINE OA
    ↓
features/line-oa/webhook/index.ts  ← receives LINE webhook events
    ↓
events/message.ts | events/postback.ts
    ↓
Agent selected (via rich menu or default) + skills loaded
    ↓
AI responds → sent back to customer via LINE Messaging API
    ↓
features/line-oa/analytics.ts  ← logs daily metrics
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| `lineOaChannel` | A connected LINE Official Account |
| `lineConversation` | Per-user persistent thread within a channel |
| Rich Menu | Visual button menu shown to LINE users; each button can switch agent |
| Broadcast | Send a message to all or filtered subscribers |
| Account Linking | Connect a LINE user to their Vaja web account |

### Key Files

| File | Purpose |
|------|---------|
| `db/schema/line-oa.ts` | All LINE OA tables |
| `features/line-oa/webhook/` | Event handlers for all LINE webhook types |
| `features/line-oa/broadcast/service.ts` | Broadcast/narrowcast logic |
| `features/line-oa/analytics.ts` | Daily stats aggregation |
| `features/line-oa/components/rich-menu-editor.tsx` | Visual rich menu builder UI |
| `app/api/line/` | Webhook endpoint (registered with LINE platform) |
| `app/api/line-oa/` | Management APIs (channels, rich menus, broadcasts) |

---

## Agent Teams

Multi-agent orchestration where specialized agents collaborate on complex tasks.

### Roles
- `orchestrator` — plans and routes tasks to specialists
- `specialist` — executes a specific subtask

### Execution Modes
- `sequential` — agents run one after another
- `planner` — orchestrator generates routing plan first

### Key Tables

| Table | Purpose |
|-------|---------|
| `agentTeam` | Team definitions (name, execution mode, credit budget) |
| `agentTeamMember` | Team membership with role |
| `teamRun` | Execution record per run |
| `teamRunStep` | Per-step execution with token/credit tracking |

---

## Content Features

These modules support content creation, planning, distribution, and analytics. They were built with marketing as the first use case but the platform is general.

| Module | Location | Purpose |
|--------|----------|---------|
| Content Marketing | `features/content-marketing/` | Content creation, trend analysis, A/B testing |
| Content Calendar | `features/content-calendar/` | Campaign briefs, scheduling, Kanban board |
| Content Hub | `features/content-hub/` | Aggregation dashboard (in progress) |
| Distribution | `features/distribution/` | Multi-channel delivery (email, LINE, webhook) |
| Collaboration | `features/collaboration/` | Approvals, comments, brand guardrails |
| Analytics | `db/schema/analytics.ts` | Metrics, A/B variants, distribution records |

### Distribution Channels

`app/api/distribution/` handles:
- `email/` — via Resend
- `line-broadcast/` — via LINE Messaging API
- `webhook/` — generic HTTP delivery
- `export/` — file export

---

## Database Schema

Schema is split across `db/schema/*.ts` files. Import from the correct domain file.

### Core Tables

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `user` | auth.ts | User accounts |
| `chatThread` | chat.ts | Conversation threads |
| `chatMessage` | chat.ts | Messages (JSONB parts) |
| `userPreferences` | users.ts | Feature flags, enabled tools, persona settings |
| `userMemory` | users.ts | Long-term memory facts |
| `userCredit` | credits.ts | Credit balance |
| `creditTransaction` | credits.ts | Transaction log |

### Agent & Skills Tables

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `agent` | agents.ts | Custom agent definitions |
| `agentShare` | agents.ts | Agent sharing |
| `agentSkill` | skills.ts | Skill definitions |
| `skillSource` | skills.ts | GitHub import source tracking |
| `agentSkillFile` | skills.ts | Bundled skill files |
| `agentSkillAttachment` | skills.ts | Agent ↔ skill junction with overrides |
| `agentTeam` | agent-teams.ts | Multi-agent team definitions |
| `agentTeamMember` | agent-teams.ts | Team membership |
| `teamRun` | agent-teams.ts | Execution records |
| `teamRunStep` | agent-teams.ts | Per-step tracking |

### LINE OA Tables

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `lineOaChannel` | line-oa.ts | Connected LINE Official Accounts |
| `lineConversation` | line-oa.ts | Per-user LINE conversation threads |
| (+ rich menu, broadcast, analytics tables) | line-oa.ts | — |

### Content Tables

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `contentPiece` | content.ts | Content (blog, email, social post, etc.) |
| `contentPieceMetric` | analytics.ts | Platform performance metrics |
| `abVariant` | analytics.ts | A/B test variants |
| `distributionRecord` | analytics.ts | Delivery tracking |
| `campaignBrief` | planning.ts | Campaign definitions |
| `contentCalendarEntry` | planning.ts | Scheduled content |
| `brand` | brands.ts | Brand definitions |
| `brandGuardrail` | collaboration.ts | Brand compliance rules |

### Media & Tools Tables

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `mediaAsset` | tools.ts | Generated/uploaded images |
| `toolRun` | tools.ts | Tool execution records |
| `toolArtifact` | tools.ts | Output files from tool runs |
| `document` | documents.ts | RAG documents (pgvector 1024-dim) |
| `documentChunk` | documents.ts | Chunked documents |

---

## Model Configuration (`lib/ai.ts`)

```typescript
export const chatModel = "google/gemini-2.5-flash-lite"  // default model
export const maxSteps = 5                                 // max tool-call steps

type Capability = "text" | "web search" | "image gen" | "embeddings" | "video gen"
```

Models that don't support tool calls: `toolDisabledModels` in `features/chat/server/routing.ts`.

---

## Styling

- **Tailwind CSS v4** — no `tailwind.config.js`, config lives in `app/globals.css`
- Colors use **oklch()** color space
- CSS variables: `--background`, `--foreground`, `--primary`, `--sidebar`, etc.
- Dark mode via `.dark` class on `<html>`
- `shadcn/ui` components in `components/ui/` — do not modify these files

---

## Page Layout Pattern

All main pages share this layout:

```tsx
<div className="min-h-screen bg-[radial-gradient(...)]">
  <div className="mx-auto flex max-w-6xl">
    <ChatSidebar ... />
    <main className="rounded-2xl border bg-white/80 dark:bg-zinc-900/80 shadow backdrop-blur">
      {/* page content */}
    </main>
  </div>
</div>
```

---

## Authentication

Better Auth in `lib/auth.ts`:
- Magic link email (Resend)
- Google OAuth (optional, checks env vars)
- Session management with IP + UA tracking
- Sign-up bonus credits granted in `onUserCreated` hook

```typescript
const session = await auth.api.getSession({ headers: req.headers });
if (!session?.user) return new Response('Unauthorized', { status: 401 });
```

---

## Sidebar Navigation

Optional nav items in `features/chat/components/sidebar/sidebar-nav.tsx`:

```typescript
export type SidebarNavItemId = "gallery" | "agents" | "skills" | "agent-teams" | "line-oa" | "content" | "certificate";
```

Persisted to `localStorage`: `chat-sidebar-visible-items`, `chat-sidebar-item-order`.

To add a new sidebar nav item: add to `OPTIONAL_NAV_ITEMS` and extend `SidebarNavItemId`.

---

## Credits System (`lib/credits.ts`)

- `getUserBalance(userId)` — current balance
- `deductCredits(userId, amount, modelId, threadId)` — deducts with log
- `getCreditCost(modelId)` — cost per request
- `SIGNUP_BONUS_CREDITS = 100`

Credit sharing: one user can distribute credits to team members. The `creditTransaction` table tracks all transfers and deductions.

Chat route returns 402 if balance is insufficient.

---

## System Prompts & Personas (`lib/prompt.ts`)

10 built-in personas: `general_assistant`, `coding_copilot`, `product_manager`, `friendly_tutor`, `data_analyst`, `summarizer_editor`, `security_privacy_guard`, `research_librarian`, `translation_localization`, `troubleshooting_debugger`

Priority for system prompt selection:
1. Agent system prompt (if `agentId` in request)
2. Custom persona (user-created)
3. Auto-detected persona (`lib/persona-detection.ts`)
4. Default: `general_assistant`

---

## RAG / Knowledge Base

- Documents: `document` table with pgvector 1024-dim embeddings (Mistral model)
- Search: `searchDocumentsByIds(query, documentIds, { limit, rerank })` — `lib/vector-store.ts`
- Reranking: Cohere cross-encoder (optional, `userPrefs.rerankEnabled`)

---

## Common Patterns

### Server Component Data Fetching
```typescript
const [userResult, prefsResult] = await Promise.all([
  db.select().from(user).where(eq(user.id, userId)).limit(1),
  db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
]);
```

### Client Mutations with TanStack Query
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch('/api/...', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['...'] }),
});
```

### Zod Validation in API Routes
```typescript
const body = await req.json();
const result = requestSchema.safeParse(body);
if (!result.success) return new Response('Bad Request', { status: 400 });
```

---

## What NOT to Do

- Do not use `npm` or `bun` — always `pnpm`
- Do not add business logic to `agent.ts` — it belongs in `service.ts`
- Do not import `service.ts` or `agent.ts` in client components
- Do not modify files in `components/ui/` (shadcn primitives)
- Do not add `useEffect` for data fetching — use TanStack Query
- Do not hardcode user IDs or model IDs — use constants from `lib/ai.ts`
- Do not skip the Zod validation layer in API routes
- Do not use `any` type in TypeScript
- Do not `git push --force` to main
- Do not create skills with hardcoded domain logic in the platform core — domain knowledge belongs in SKILL.md files, not in application code

---

## Environment Variables

```
DATABASE_URL              # Neon Postgres connection string
BETTER_AUTH_SECRET        # Random secret for session signing
OPENAI_API_KEY            # Via openrouter or direct OpenAI
RESEND_API_KEY            # Email sending
R2_ACCOUNT_ID             # Cloudflare R2
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
LINE_CHANNEL_SECRET       # LINE webhook signature verification
LINE_CHANNEL_ACCESS_TOKEN # LINE Messaging API
GOOGLE_CLIENT_ID          # Optional — Google OAuth
GOOGLE_CLIENT_SECRET      # Optional
COHERE_API_KEY            # Optional — reranking
```
