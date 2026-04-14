# Implementation Guide

**Studio Chat** — AI-powered chat platform with RAG, tools, credits, and multi-model support.

> This document is for **all contributors**: human developers, AI coding assistants (Cursor, Copilot, GPT, Gemini), and new team members.
> For Claude Code specifics, see `CLAUDE.md`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Getting Started](#3-getting-started)
4. [Architecture Overview](#4-architecture-overview)
5. [Directory Structure](#5-directory-structure)
6. [Database Schema](#6-database-schema)
7. [Core Systems](#7-core-systems)
   - [AI Chat Pipeline](#71-ai-chat-pipeline)
   - [Tool System](#72-tool-system)
   - [Authentication](#73-authentication)
   - [Credits System](#74-credits-system)
   - [RAG / Knowledge Base](#75-rag--knowledge-base)
   - [Certificate System](#76-certificate-system)
   - [Persona System](#77-persona-system)
   - [Sidebar Navigation](#78-sidebar-navigation)
8. [Adding a New Tool](#8-adding-a-new-tool)
9. [Adding a New Page](#9-adding-a-new-page)
10. [Adding a New API Route](#10-adding-a-new-api-route)
11. [Coding Conventions](#11-coding-conventions)
12. [Common Code Patterns](#12-common-code-patterns)
13. [Styling Guide](#13-styling-guide)
14. [Environment Variables](#14-environment-variables)
15. [What NOT to Do](#15-what-not-to-do)

---

## 1. Project Overview

Studio Chat is a full-stack Next.js application that provides:

- **AI Chat** — multi-model chat with streaming, tool calls, image generation, and voice input
- **Knowledge Base** — document upload with RAG (retrieval-augmented generation) and vector search
- **Tools** — pluggable AI tools (quiz generator, certificate generator, etc.) that work both in chat and as standalone pages
- **Agents** — custom AI assistants with their own system prompts and document access
- **Credits** — per-user credit system with per-model costs
- **Media Gallery** — generated image management with editing and versioning
- **Multi-persona** — automatic persona detection and user-customizable AI personalities

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js App Router | 16.1.6 | Turbopack in dev |
| Language | TypeScript | 5.9 | Strict mode |
| Auth | Better Auth | 1.4 | Magic link + Google OAuth |
| Database | Neon (serverless Postgres) | — | pgvector extension enabled |
| ORM | Drizzle ORM | 0.45 | Type-safe, no code generation |
| AI SDK | Vercel AI SDK | 6.0 | `streamText`, `generateText`, `generateImage` |
| AI Providers | @ai-sdk/openai (via OpenRouter) | 3.0 | Gemini, GPT, Claude, etc. |
| UI Components | shadcn/ui | — | Radix UI primitives |
| Styling | Tailwind CSS v4 | 4.1 | Config in `globals.css`, oklch colors |
| Client State | TanStack Query | 5.90 | All server state |
| Tables | TanStack Table | 8.21 | Models page |
| Icons | Lucide React | 0.563 | |
| Notifications | Sonner | 2.0 | Bottom-center toasts |
| Validation | Zod | 4.3 | All API boundaries |
| Email | Resend | 6.9 | Transactional email |
| File storage | Cloudflare R2 (S3) | — | Images, certificates |
| PDF generation | pdf-lib + Sharp | — | Certificate export |
| Animations | Motion (Framer) | 12.31 | |
| Code highlight | Shiki | 3.22 | Chat code blocks |
| Package manager | **pnpm** | — | **Required** |

---

## 3. Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Neon database (or any Postgres with pgvector)

### Install & Run

```bash
# Clone and install
git clone <repo>
cd ai-sdk
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in the required values (see Section 14)

# Set up the database
pnpm drizzle-kit migrate

# Start the development server (Turbopack)
pnpm dev
```

### Useful Scripts

```bash
pnpm dev                      # Start dev server with Turbopack
pnpm build                    # Production build
pnpm start                    # Start production server
pnpm exec tsc --noEmit        # Type-check without emitting files
pnpm drizzle-kit generate     # Generate migration from schema changes
pnpm drizzle-kit migrate      # Apply pending migrations
pnpm drizzle-kit studio       # Open Drizzle Studio (DB UI)
```

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React 19)                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Sidebar  │  │  Chat UI     │  │  Tool Pages       │  │
│  │ Nav      │  │  (streaming) │  │  /tools/[slug]    │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│         TanStack Query (client state management)         │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / Streaming
┌───────────────────────▼─────────────────────────────────┐
│                  Next.js App Router                       │
│  ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │  app/api/chat    │   │  app/api/tools/[slug]/run    │ │
│  │  (main pipeline) │   │  (tool execution API)        │ │
│  └────────┬─────────┘   └──────────────┬───────────────┘ │
└───────────┼──────────────────────────── ┼ ───────────────┘
            │                             │
┌───────────▼──────────────────────────── ▼ ───────────────┐
│              Service Layer (features/<tool>/service.ts)   │
│   quiz/service.ts   certificate/service.ts   ...         │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Data Layer                               │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Neon Postgres  │  │ Cloudflare   │  │  Vercel AI  │  │
│  │ + pgvector     │  │ R2 (files)   │  │  (models)   │  │
│  └────────────────┘  └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### The One Architectural Rule

> **Every tool has one canonical `service.ts`. The agent adapter, the API route, and the sidebar page all call that same service. Business logic is never duplicated.**

```
Agent call  ──►  features/<tool>/agent.ts  ──►  features/<tool>/service.ts
API route   ──►  app/api/tools/[slug]/run  ──►  features/<tool>/service.ts
Sidebar     ──►  React Query mutation       ──►  features/<tool>/service.ts
```

---

## 5. Directory Structure

```
ai-sdk/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (fonts, providers, Toaster)
│   ├── globals.css                   # Tailwind v4 config + theme variables
│   ├── providers.tsx                 # Client providers (Auth, QueryClient)
│   ├── page.tsx                      # Home / chat page
│   ├── gallery/page.tsx
│   ├── models/page.tsx
│   ├── settings/page.tsx
│   ├── agents/page.tsx
│   ├── knowledge/page.tsx
│   ├── certificate/page.tsx          # Legacy certificate page
│   ├── quiz/page.tsx                 # Legacy quiz page
│   ├── tools/
│   │   └── [toolSlug]/
│   │       ├── page.tsx              # Dynamic tool page dispatcher
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── admin/
│   │   ├── credits/page.tsx
│   │   └── users/page.tsx
│   └── api/
│       ├── chat/route.ts             # ★ Main AI streaming endpoint
│       ├── certificate/              # Certificate API routes
│       ├── agents/                   # Agent CRUD API
│       ├── threads/                  # Thread CRUD API
│       ├── messages/                 # Message API
│       ├── rag/                      # Document upload + search API
│       ├── images/                   # Image generation API
│       ├── credits/                  # Credit balance API
│       ├── user/                     # User profile API
│       └── auth/                     # Better Auth handler
│
├── features/                         # Domain modules (write new code here)
│   ├── chat/
│   │   ├── components/
│   │   │   ├── chat-sidebar.tsx      # Root sidebar (desktop + mobile drawer)
│   │   │   ├── chat-header.tsx
│   │   │   ├── chat-composer.tsx     # Message input area
│   │   │   ├── sidebar/
│   │   │   │   ├── sidebar-nav.tsx   # ★ Nav items (add new pages here)
│   │   │   │   ├── sidebar-content.tsx
│   │   │   │   ├── sidebar-account.tsx
│   │   │   │   ├── sidebar-thread-list.tsx
│   │   │   │   ├── sidebar-thread-row.tsx
│   │   │   │   └── sidebar-search.tsx
│   │   │   └── message-list/         # Message rendering components
│   │   ├── hooks/
│   │   │   ├── use-chat-session.ts   # ★ Core chat state machine
│   │   │   ├── use-threads.ts        # Thread list CRUD
│   │   │   ├── use-model-selector.ts
│   │   │   ├── use-live-voice.ts
│   │   │   └── use-message-reactions.ts
│   │   ├── server/
│   │   │   ├── schema.ts             # Zod schemas for chat request/response
│   │   │   ├── routing.ts            # Model routing (intent detection)
│   │   │   ├── persistence.ts        # Save messages to DB
│   │   │   └── thread-utils.ts
│   │   └── types.ts                  # ChatMessage, ThreadItem types
│   │
│   ├── tools/
│   │   └── registry/
│   │       ├── types.ts              # ToolManifest, ToolExecutionResult types
│   │       ├── client.ts             # Client-safe (manifests only)
│   │       └── server.ts             # Server (imports agent adapters)
│   │
│   ├── quiz/                         # ★ Quiz / Exam Prep tool
│   │   ├── manifest.ts               # id, slug, title, icon, category
│   │   ├── schema.ts                 # Zod input/output schemas
│   │   ├── service.ts                # ★ CANONICAL LOGIC
│   │   ├── agent.ts                  # Thin AI SDK wrapper
│   │   ├── types.ts
│   │   └── components/
│   │       └── quiz-tool-page.tsx
│   │
│   ├── certificate/                  # ★ Certificate Generator tool
│   │   ├── manifest.ts
│   │   ├── schema.ts
│   │   ├── service.ts                # Re-exports lib/certificate-service.ts
│   │   ├── agent.ts                  # Thin AI SDK wrapper
│   │   ├── types.ts
│   │   ├── hooks/use-templates.ts
│   │   └── components/
│   │       ├── certificate-tool-page.tsx
│   │       ├── certificate-form.tsx
│   │       ├── batch-form.tsx
│   │       ├── template-selector.tsx
│   │       ├── template-uploader.tsx
│   │       └── job-history.tsx
│   │
│   ├── gallery/
│   │   ├── components/image-editor/
│   │   ├── hooks/
│   │   └── types.ts
│   │
│   ├── models/
│   │   └── components/models-table.tsx
│   │
│   ├── settings/
│   │   └── components/
│   │       ├── tools-section.tsx
│   │       ├── memory-section.tsx
│   │       └── custom-personas-section.tsx
│   │
│   └── agents/
│       └── components/
│
├── lib/                              # Shared utilities
│   ├── ai.ts                         # ★ availableModels, chatModel, maxSteps
│   ├── db.ts                         # Drizzle + Neon connection export
│   ├── auth.ts                       # Better Auth configuration
│   ├── auth-client.ts                # Client-side auth helpers
│   ├── prompt.ts                     # System prompts (10 personas)
│   ├── credits.ts                    # Credit balance + deduction
│   ├── memory.ts                     # Memory extraction + injection
│   ├── tool-registry.ts              # Legacy tool ID → metadata map
│   ├── tools/
│   │   ├── index.ts                  # ★ buildToolSet() factory
│   │   ├── rag.ts                    # Knowledge base AI SDK tools
│   │   └── weather.ts               # Weather tools
│   ├── certificate-service.ts        # Certificate business logic (622 lines)
│   ├── certificate-generator.ts      # Low-level PDF/PNG generation
│   ├── vector-store.ts               # pgvector search
│   ├── rag-tool.ts                   # RAG AI SDK tools
│   ├── r2.ts                         # Cloudflare R2 client
│   └── utils.ts                      # cn(), misc helpers
│
├── components/
│   ├── ui/                           # shadcn/ui — DO NOT EDIT
│   ├── message-renderer/             # Chat message part renderers
│   └── ai-elements/                  # AI-specific components
│
└── db/
    ├── schema.ts                     # ★ All Drizzle table definitions
    └── migrations/                   # Generated SQL migrations
```

---

## 6. Database Schema

All tables are in `db/schema.ts` using Drizzle ORM.

### Tables Reference

#### Auth & Users
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `user` | id, name, email, approved | User accounts |
| `session` | id, token, userId, expiresAt | Auth sessions |
| `account` | providerId, accountId, userId | OAuth providers |
| `verification` | identifier, value, expiresAt | Email verification |
| `userPreferences` | userId, enabledToolIds, rerankEnabled, memoryEnabled | Feature flags |
| `userModelPreference` | userId, modelIds[] | Per-user model list |
| `userModelScore` | userId, modelId, score | Model quality ratings |

#### Chat
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `chatThread` | id, userId, title, pinned | Conversation threads |
| `chatMessage` | id, threadId, role, parts(jsonb), metadata(jsonb) | Messages |
| `tokenUsage` | threadId, model, promptTokens, completionTokens | Usage tracking |

#### Tools
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `toolRun` | id, toolSlug, userId, threadId, source, inputJson, outputJson, status | All tool executions |
| `toolArtifact` | id, toolRunId, kind, format, storageUrl, payloadJson | Tool outputs |

#### Knowledge Base (RAG)
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `document` | id, userId, content, embedding(vector 1024) | Documents with embeddings |
| `documentChunk` | id, documentId, content, embedding | Chunked large docs |

#### Certificates
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `certificateTemplate` | id, userId, name, fields(jsonb), r2Key, printSettings | Templates |
| `certificateJob` | id, userId, templateId, status, format, exportMode, resultUrl | Generation jobs |

#### Media
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `mediaAsset` | id, userId, threadId, r2Key, url, parentAssetId, version | Images with history |

#### Credits
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `userCredit` | userId, balance | Current balance |
| `creditTransaction` | userId, amount, type, modelId, threadId | Transaction log |

#### Agents & Memory
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `agent` | id, userId, name, systemPrompt, enabledTools[], documentIds[] | Custom agents |
| `agentShare` | agentId, sharedWithUserId | Agent sharing |
| `userMemory` | userId, content, createdAt | Long-term memory facts |
| `customPersona` | userId, name, systemPrompt | User-created personas |

### Making Schema Changes

1. Edit `db/schema.ts`
2. Run `pnpm drizzle-kit generate` — creates a migration file in `db/migrations/`
3. Run `pnpm drizzle-kit migrate` — applies it to the database
4. Commit both `db/schema.ts` and the new migration file

---

## 7. Core Systems

### 7.1 AI Chat Pipeline

**Entry point:** `app/api/chat/route.ts`

The route processes requests in sequential stages, with parallel work inside each stage:

```
POST /api/chat
│
├─ Stage 1: Validate
│   ├── auth.api.getSession()         check session
│   └── requestSchema.parse(body)     validate request
│
├─ Stage 2: Load context (all parallel)
│   ├── fetch user record
│   ├── fetch chatThread (verify ownership)
│   ├── fetch userPreferences
│   ├── fetch userCredit balance
│   ├── fetch agent (if agentId)
│   └── fetch persona + customization
│
├─ Stage 3: AI context (parallel)
│   ├── extractMemoryContext()        inject past facts
│   └── detectPersona()              auto-detect from message
│
├─ Stage 4: Build prompt
│   └── priority: agent > customPersona > detectedPersona > general_assistant
│
├─ Stage 5: Build tools
│   └── buildToolSet({ enabledToolIds, userId, documentIds, rerankEnabled })
│
├─ Stage 6: Stream response
│   ├── if image model → generateImage()
│   └── else → streamText({ model, system, messages, tools, maxSteps: 5 })
│
└─ Stage 7: Persist (onFinish callback)
    ├── saveMessages()
    ├── saveTokenUsage()
    ├── generateFollowUpSuggestions()
    └── extractMemory()              (if memoryEnabled)
```

**Key files:**
- `features/chat/server/routing.ts` — `getModelByIntent()` (auto model selection)
- `features/chat/server/persistence.ts` — `saveMessages()`
- `lib/tools/index.ts` — `buildToolSet()`
- `lib/prompt.ts` — `getSystemPrompt(key)`
- `lib/memory.ts` — `extractMemory()`, `getMemoryContext()`

---

#### Skills in Chat

Skills let an agent pick up specialized behavior and knowledge only when needed. When chat runs with an active agent, the system loads that agent's attached skills, checks which ones apply to the latest user message, and injects the matching skill instructions into the system prompt.

There are two separate settings:

| Setting | What it controls |
|---------|------------------|
| `activationMode` | How the skill becomes active: explicit rule or model discovery |
| `triggerType` | Which explicit rule to use: always active, slash command, or keyword match |

**How they work together**

- `rule` + `always` - the skill is active on every message while that agent is selected
- `rule` + `slash` - the skill activates only when the message starts with the configured slash command, such as `/email`
- `rule` + `keyword` - the skill activates when the message contains the configured keyword
- `model` + any trigger type - the trigger rule is ignored at runtime; the app scores the message against the skill's name, description, and prompt text, then activates the best-matching skills

For model-discovered skills, the runtime first exposes them in an `available_skills` catalog, then promotes the top matches into `active_skills`. Activated skills can also contribute bundled reference files into `skill_resources`, plus any tools unlocked by that skill.

**Examples**

- A `brand-voice` skill using `rule` + `always` is present in every reply for that agent.
- An `email-writer` skill using `rule` + `slash` with trigger `/email` activates for `/email draft a launch note`, but not for `please /email draft a launch note`.
- A `thai-seo` skill using `model` can activate automatically for `help me plan keywords for a Thai clinic article`, even though the user did not type a command.

Attachment settings can override the base skill per agent, so the same skill can be model-discovered for one agent and rule-based for another.

---

### 7.2 Tool System

Tools are AI capabilities that work in two contexts:
1. **Agent mode** — called by the AI during `streamText()` via AI SDK `tool()`
2. **Sidebar mode** — called directly by the user via a dedicated page at `/tools/[slug]`

#### 4-Layer Architecture Per Tool

```
manifest.ts   → discovery metadata (id, slug, title, icon, category, defaultEnabled)
schema.ts     → Zod input/output validation (shared by UI and agent)
service.ts    → canonical business logic (THE ONLY PLACE work happens)
              → raw functions (used by agent adapters)
              → *Action() wrappers (return ToolExecutionResult — used by API/sidebar)
agent.ts      → thin AI SDK tool() adapter (calls service, no logic)
```

#### Tool Registry

| File | Imports | Used by |
|------|---------|---------|
| `features/tools/registry/client.ts` | manifests only | Sidebar, settings, client components |
| `features/tools/registry/server.ts` | manifests + agent adapters | API routes, chat route — `buildRegistryAgentTools()` |
| `features/tools/registry/page-loaders.ts` | page components (dynamic) | `app/tools/[toolSlug]/page.tsx` only |

#### Current Registered Tools

| Tool ID | Slug | Category | Agent tools |
|---------|------|----------|-------------|
| `exam_prep` | `quiz` | study | generate_practice_quiz, grade_practice_answer, create_study_plan, analyze_learning_gaps, generate_flashcards |
| `certificate` | `certificate` | content | list_certificate_templates, preview_certificate_generation, generate_certificate_output, generate_certificate |
| `knowledge_base` | *(no page)* | — | searchKnowledge, retrieveDocument |
| `weather` | *(no page)* | utilities | weather, convertFahrenheitToCelsius |

#### Tool ID vs Slug

- **`id`** (`exam_prep`, `certificate`) — stored in `userPreferences.enabledToolIds` in the DB; used in `lib/tool-registry.ts` and `buildToolSet()`
- **`slug`** (`quiz`, `certificate`) — used in URL `/tools/[toolSlug]` and in the manifest

> Note: the exam prep tool has `id: 'exam_prep'` but `slug: 'quiz'` — the user-facing name changed.

#### buildToolSet()

`lib/tools/index.ts` — called by the chat API route. Internally delegates registry-managed tools to `buildRegistryAgentTools()` in the server registry, keeping special tools (weather, knowledge_base) hardcoded:

```typescript
buildToolSet({
  enabledToolIds: userPrefs.enabledToolIds ?? ALL_TOOL_IDS,
  userId: session.user.id,
  documentIds: effectiveDocIds,     // agent docs + selected docs
  rerankEnabled: userPrefs.rerankEnabled ?? false,
  source: 'manual',                 // 'manual' | 'agent'
  certificateMaxRecipients: 100,
})
```

Adding a new registry-managed tool never requires changing `buildToolSet()`. Only `features/tools/registry/server.ts` needs updating.

---

### 7.3 Authentication

Better Auth (`lib/auth.ts`) with two providers:

| Provider | Config |
|----------|--------|
| Magic link | Sends email via Resend; no password needed |
| Google OAuth | Optional; enabled when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set |

**Session check in API routes:**
```typescript
import { auth } from '@/lib/auth';
const session = await auth.api.getSession({ headers: req.headers });
if (!session?.user) return new Response('Unauthorized', { status: 401 });
```

**Session check in Server Components:**
```typescript
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
const session = await auth.api.getSession({ headers: await headers() });
```

**Client-side session:**
```typescript
import { authClient } from '@/lib/auth-client';
const { data: session } = authClient.useSession();
```

On signup, a `onUserCreated` hook in `lib/auth.ts` grants 100 free credits via `addCredits()`.

---

### 7.4 Credits System

`lib/credits.ts` — every AI request costs credits depending on the model.

```typescript
// Key functions
getCreditCost(modelId: string): number
getUserBalance(userId: string): Promise<number>
deductCredits(userId, amount, modelId, threadId): Promise<void>
addCredits(userId, amount, type, description): Promise<void>
```

**Flow in chat route:**
1. `getUserBalance(userId)` — check before streaming
2. If balance < cost → return `402 Payment Required`
3. On finish → `deductCredits()` with actual model used

**Credit costs by model** (approximate, in `lib/credits.ts`):
- Gemini Flash Lite → 1 credit
- Gemini Flash → 2 credits
- GPT-5 Mini → 3 credits
- Claude Sonnet → 5 credits
- Claude Opus / GPT-5.2 → 8–10 credits

---

### 7.5 RAG / Knowledge Base

Documents are stored with pgvector embeddings for semantic search.

```
Upload flow:
  POST /api/rag/ingest
    → lib/document-ingestion.ts
    → chunk text
    → lib/embeddings.ts (Mistral embed, 1024-dim)
    → insert into document + documentChunk tables

Search flow:
  searchDocumentsByIds(query, documentIds, { limit, rerank })
    → lib/vector-store.ts
    → cosine similarity search via pgvector
    → optional Cohere reranking
    → returns SearchResult[]
```

**In tools**, use the grounding helper pattern from `features/quiz/service.ts`:
```typescript
const results = await searchDocumentsByIds(query, options.documentIds, {
  limit: 4,
  rerank: options.rerankEnabled ?? false,
});
```

---

### 7.6 Certificate System

Main logic: `lib/certificate-service.ts` (622 lines)
Feature layer: `features/certificate/service.ts` (re-exports from lib)

```typescript
// Generate certificates
generateCertificateOutput({
  userId,
  templateId,
  recipients: [{ values: { name: 'Alice', date: '2026-01-01' } }],
  format: 'pdf',          // 'png' | 'jpg' | 'pdf'
  outputMode: 'zip',      // 'single_file' | 'zip' | 'single_pdf' | 'sheet_pdf'
  source: 'manual',       // 'manual' | 'agent'
  maxRecipients: 500,
})
```

Output files are uploaded to Cloudflare R2. Every generation creates a `certificateJob` row for history.

---

### 7.7 Persona System

Personas control the AI's tone, expertise, and focus.

**Built-in personas** (`lib/prompt.ts`):
```
general_assistant       coding_copilot         product_manager
friendly_tutor          data_analyst           summarizer_editor
security_privacy_guard  research_librarian     translation_localization
troubleshooting_debugger
```

**System prompt priority** (highest wins):
```
1. Agent system prompt (if request has agentId)
2. User's custom persona (customPersona table)
3. Auto-detected persona (lib/persona-detection.ts, based on message content)
4. Default: general_assistant
```

**Per-persona customization**: users can add extra instructions to any persona via `personaCustomization` table. These are appended to the base system prompt.

---

### 7.8 Sidebar Navigation

File: `features/chat/components/sidebar/sidebar-nav.tsx`

The sidebar has **optional nav items** — users can toggle visibility and drag to reorder.

```typescript
// Type of all optional item IDs
export type SidebarNavItemId = "gallery" | "agents" | "certificate";

// The items array — add new pages here
export const OPTIONAL_NAV_ITEMS: NavItem[] = [
  { id: "gallery",     href: "/gallery",     label: "Media gallery", icon: <...> },
  { id: "agents",      href: "/agents",      label: "Agents",        icon: <...> },
  { id: "certificate", href: "/certificate", label: "Certificates",  icon: <...> },
];
```

State is persisted to `localStorage`:
```
"chat-sidebar-collapsed"        boolean
"chat-sidebar-visible-items"    SidebarNavItemId[]
"chat-sidebar-item-order"       SidebarNavItemId[]
```

---

## 8. Adding a New Tool

Follow this checklist in order. After step 8, the tool appears automatically in settings toggles and agent tool selection.

### Step 1 — Create the manifest

```typescript
// features/<toolName>/manifest.ts
import type { ToolManifest } from '@/features/tools/registry/types';

export const myToolManifest: ToolManifest = {
  id: 'my_tool',           // stable DB key — never change after first deploy
  slug: 'my-tool',         // URL slug → /tools/my-tool
  title: 'My Tool',
  description: 'What it does in one sentence.',
  icon: 'Wrench',          // any Lucide icon name (string, not component)
  category: 'utilities',   // 'study' | 'content' | 'assessment' | 'utilities' | 'developer'
  professions: ['all'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,   // true = on for new users by default
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
```

### Step 2 — Define the schema

```typescript
// features/<toolName>/schema.ts
import { z } from 'zod';

export const myToolInputSchema = z.object({
  topic: z.string().min(1),
  // ...
});

export type MyToolInput = z.infer<typeof myToolInputSchema>;
```

### Step 3 — Write the service (all logic goes here)

The service has two levels:
- **Raw functions** (`runXxx`) — called by agent adapters; return domain data
- **Action wrappers** (`xxxAction`) — called by API routes and sidebar; return `ToolExecutionResult`

```typescript
// features/<toolName>/service.ts
import { nanoid } from 'nanoid';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import type { MyToolInput } from './schema';

export type MyToolOptions = { userId: string };

// Raw function — agent adapter calls this
export async function runMyTool(input: MyToolInput, options: MyToolOptions) {
  // all business logic here
  return { result: '...' };
}

// Normalized wrapper — API route / sidebar calls this
export async function myToolAction(
  input: MyToolInput,
  options: MyToolOptions,
): Promise<ToolExecutionResult> {
  const data = await runMyTool(input, options);
  return {
    tool: 'my_tool',
    runId: nanoid(),
    title: `My Tool: ${input.topic}`,
    summary: 'Brief description of result',
    data,
    createdAt: new Date().toISOString(),
  };
}
```

### Step 4 — Write the thin agent adapter

```typescript
// features/<toolName>/agent.ts
import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { myToolInputSchema } from './schema';
import { runMyTool } from './service';

export function createMyToolAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  return {
    my_tool_action: tool({
      description: 'What the AI agent sees. Be specific.',
      inputSchema: myToolInputSchema,
      async execute(input) {
        return { success: true, ...(await runMyTool(input, { userId: ctx.userId })) };
      },
    }),
  };
}
```

### Step 5 — Create types file (optional but recommended)

```typescript
// features/<toolName>/types.ts
export type MyToolResult = Awaited<ReturnType<typeof import('./service').runMyTool>>;
```

### Step 6 — Register in client registry

```typescript
// features/tools/registry/client.ts — add:
import { myToolManifest } from '@/features/<toolName>/manifest';

export const TOOL_MANIFESTS: ToolManifest[] = [
  quizManifest,
  certificateManifest,
  myToolManifest,      // ← add here
];
```

### Step 7 — Register in server registry

```typescript
// features/tools/registry/server.ts — add:
import { myToolManifest } from '@/features/<toolName>/manifest';
import { createMyToolAgentTools } from '@/features/<toolName>/agent';

const SERVER_REGISTRY: RegisteredTool[] = [
  // ...existing entries...
  {
    manifest: myToolManifest,
    getAgentDefinition: (ctx) => createMyToolAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${myToolManifest.slug}`,
  },
];
```

### Step 8 — Register in tool-registry.ts (for user preferences)

```typescript
// lib/tool-registry.ts — add entry:
export const TOOL_REGISTRY = {
  // ...existing...
  my_tool: {
    label: 'My Tool',
    description: 'Short description for the settings toggle.',
    group: 'utilities',
    defaultEnabled: false,
  },
} as const;
```

### Step 9 — Create the sidebar page component

```typescript
// features/<toolName>/components/<toolName>-tool-page.tsx
'use client';
import type { ToolManifest } from '@/features/tools/registry/types';

export function MyToolPage({ manifest }: { manifest: ToolManifest }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{manifest.title}</h1>
      {/* tool UI here */}
    </div>
  );
}
```

### Step 10 — Register the page loader

```typescript
// features/tools/registry/page-loaders.ts — add one entry:
export const TOOL_PAGE_LOADERS: Record<string, ToolPageLoader> = {
  // ...existing entries...
  'my-tool': async () => {
    const { MyToolPage } = await import('@/features/my-tool/components/my-tool-page');
    return MyToolPage;
  },
};
```

`app/tools/[toolSlug]/page.tsx` picks it up automatically — **no changes needed there**.

**Done.** The tool now:
- Appears in the settings tools toggle list
- Is available to the AI agent when enabled by the user
- Has a standalone page at `/tools/my-tool`

---

## 9. Adding a New Page

### 1. Create the route

```
app/<pageName>/page.tsx
app/<pageName>/loading.tsx   (optional)
app/<pageName>/error.tsx     (optional, must be 'use client')
```

### 2. Use the standard page layout

```tsx
// app/<pageName>/page.tsx
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
// or just match the pattern from app/gallery/page.tsx

export default function MyPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-50 via-background to-background dark:from-violet-950/20">
      <div className="mx-auto flex max-w-6xl">
        {/* sidebar is rendered by the parent layout or composed here */}
        <main className="flex-1 rounded-2xl border bg-white/80 dark:bg-zinc-900/80 shadow backdrop-blur m-4">
          {/* content */}
        </main>
      </div>
    </div>
  );
}
```

### 3. Add a sidebar nav link (optional)

In `features/chat/components/sidebar/sidebar-nav.tsx`:

```typescript
// Extend the type:
export type SidebarNavItemId = "gallery" | "agents" | "certificate" | "my-page";

// Add to the array:
export const OPTIONAL_NAV_ITEMS: NavItem[] = [
  // ...existing items...
  {
    id: "my-page",
    href: "/my-page",
    label: "My Page",
    icon: <MyIcon className="size-4" />,
    matchFn: (p) => p.startsWith("/my-page"),
  },
];
```

---

## 10. Adding a New API Route

### Basic pattern

```typescript
// app/api/<resource>/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

const requestSchema = z.object({
  // define your input
});

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // 2. Validate
  const body = await req.json();
  const result = requestSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  // 3. Business logic
  const data = await doWork(result.data, session.user.id);

  // 4. Respond
  return Response.json(data);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const data = await db.select()...;
  return Response.json(data);
}
```

### Tool execution API route

```typescript
// app/api/tools/[toolSlug]/run/route.ts
import { runMyTool } from '@/features/my-tool/service';

export async function POST(req: NextRequest, { params }: { params: { toolSlug: string } }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const input = inputSchema.parse(await req.json());
  const result = await runMyTool(input, { userId: session.user.id });

  return Response.json({
    tool: params.toolSlug,
    runId: nanoid(),
    data: result,
    createdAt: new Date().toISOString(),
  });
}
```

---

## 11. Coding Conventions

### TypeScript

```typescript
// Always use explicit types — never 'any'
function processItem(item: MyType): ProcessedType { ... }

// Prefer type over interface for data shapes
type UserPrefs = { memoryEnabled: boolean; enabledToolIds: string[] };

// Use 'satisfies' for const objects with type checking
const config = { ... } satisfies MyConfigType;

// Zod for runtime validation at all boundaries
const input = schema.parse(rawData);
```

### File naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Components | kebab-case | `quiz-tool-page.tsx` |
| Hooks | kebab-case with `use-` prefix | `use-chat-session.ts` |
| Utilities | kebab-case | `certificate-service.ts` |
| Types | camelCase exports | `export type ToolManifest` |
| Constants | SCREAMING_SNAKE or camelCase | `TOOL_MANIFESTS`, `chatModel` |

### Component structure

```typescript
'use client'; // only when needed (event handlers, useState, useEffect)

import { useState } from 'react';
import { ComponentName } from '@/components/ui/component-name';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  onClick?: () => void;
};

export function MyComponent({ label, onClick }: Props) {
  const [open, setOpen] = useState(false);
  return <div>{label}</div>;
}
```

### Imports — always use `@/` alias

```typescript
// Correct
import { db } from '@/lib/db';
import { chatThread } from '@/db/schema';
import { quizManifest } from '@/features/quiz/manifest';

// Wrong
import { db } from '../../../lib/db';
```

### Server vs Client components

```
Server Component (default)  — data fetching, DB queries, no interactivity
Client Component ('use client') — event handlers, useState, useEffect, browser APIs
```

Use Server Components as much as possible. Push `'use client'` to the leaf nodes.

---

## 12. Common Code Patterns

### Parallel DB queries (server)

```typescript
const [userRows, prefsRows] = await Promise.all([
  db.select().from(user).where(eq(user.id, userId)).limit(1),
  db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
]);
const userRecord = userRows[0];
const prefs = prefsRows[0];
```

### TanStack Query — data fetching (client)

```typescript
import { useQuery } from '@tanstack/react-query';

function useMyData(id: string) {
  return useQuery({
    queryKey: ['my-data', id],
    queryFn: async () => {
      const res = await fetch(`/api/my-resource/${id}`);
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<MyDataType>;
    },
  });
}
```

### TanStack Query — mutations (client)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useSaveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: MyInput) => {
      const res = await fetch('/api/my-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-data'] });
    },
  });
}
```

### Insert to DB with nanoid

```typescript
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { myTable } from '@/db/schema';

await db.insert(myTable).values({
  id: nanoid(),
  userId,
  createdAt: new Date(),
  // ...
});
```

### Zod validation in API route

```typescript
const body = await req.json().catch(() => null);
if (!body) return new Response('Invalid JSON', { status: 400 });

const result = schema.safeParse(body);
if (!result.success) {
  return new Response(JSON.stringify(result.error.flatten()), { status: 400 });
}
const { field1, field2 } = result.data;
```

### Toast notifications (client)

```typescript
import { toast } from 'sonner';

toast.success('Done!');
toast.error('Something went wrong.');
toast.promise(asyncFn(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed to save.',
});
```

### cn() — conditional class names

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'large' && 'large-class',
)} />
```

---

## 13. Styling Guide

### Tailwind CSS v4

Config lives entirely in `app/globals.css` — there is no `tailwind.config.js`.

```css
/* app/globals.css */
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  /* maps CSS vars to Tailwind token names */
}

:root {
  /* Light mode — oklch color space */
  --background: oklch(0.9730 0.0133 286.1503);
  --foreground: oklch(0.3015 0.0572 282.4176);
  --primary: oklch(0.5417 0.1790 288.0332);
  /* ... */
}

.dark {
  --background: oklch(0.1743 0.0227 283.7998);
  /* ... */
}
```

### Using theme tokens

```tsx
// Use semantic class names (not raw colors)
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<p className="text-muted-foreground" />
<div className="border border-border" />
```

### Dark mode

Dark mode is controlled by the `.dark` class on `<html>`. It is toggled in `app/providers.tsx` via `next-themes`.

```tsx
// To style dark mode
<div className="bg-white dark:bg-zinc-900" />
<p className="text-gray-700 dark:text-gray-300" />
```

### shadcn/ui Components

Located in `components/ui/`. Use as-is — do not modify these files.

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
```

### Fonts

8 fonts loaded in `app/layout.tsx`:
- `Geist Sans` / `Geist Mono` — main UI font (headings use `var(--font-heading)`)
- `Inter` — alternative
- `Playfair Display` — decorative
- Thai fonts: `Noto Sans Thai`, `Sarabun`, `IBM Plex Sans Thai`, `Anuphan`

Custom certificate fonts are loaded via `@font-face` in `globals.css`.

---

## 14. Environment Variables

Create `.env.local` with the following:

```bash
# ── Required ──────────────────────────────────────────────────────────────────

# Neon serverless Postgres connection string
DATABASE_URL="postgresql://..."

# Better Auth — random string, keep secret
BETTER_AUTH_SECRET="your-random-secret-here"

# Better Auth URL (your deployment URL)
BETTER_AUTH_URL="http://localhost:3000"

# AI models — OpenRouter or direct OpenAI
OPENAI_API_KEY="sk-..."
# OPENAI_BASE_URL="https://openrouter.ai/api/v1"  # if using OpenRouter

# Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# Cloudflare R2 (file storage)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
R2_PUBLIC_URL="https://..."    # public base URL for R2 files

# ── Optional ──────────────────────────────────────────────────────────────────

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Cohere (cross-encoder reranking for RAG)
COHERE_API_KEY="..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 15. What NOT to Do

### Architecture

- **Do not** add business logic to `agent.ts` — it belongs in `service.ts`
- **Do not** import `service.ts` or `agent.ts` in client components or pages
- **Do not** duplicate tool logic between agent and sidebar/API paths
- **Do not** bypass the Zod validation layer in API routes

### Database

- **Do not** write raw SQL — use Drizzle ORM
- **Do not** edit migration files after they've been applied
- **Do not** forget to run `drizzle-kit generate` after schema changes

### React / Next.js

- **Do not** use `useEffect` for data fetching — use TanStack Query
- **Do not** put heavy logic in Server Components that could move to a service
- **Do not** modify files in `components/ui/` (shadcn primitives)
- **Do not** use `any` in TypeScript

### Package Manager

- **Do not** use `npm install` or `bun install` — always `pnpm install`
- **Do not** mix lock files

### Styling

- **Do not** use inline styles — use Tailwind classes
- **Do not** add `tailwind.config.js` — v4 config is in `globals.css`
- **Do not** hardcode color hex values — use theme tokens (`bg-background`, `text-foreground`)

### Git

- **Do not** commit `.env.local` or secrets
- **Do not** force push to `main`
- **Do not** amend published commits

---

## Quick Reference

| Task | File to edit |
|------|-------------|
| Add an AI model | `lib/ai.ts` → `availableModels` |
| Add a tool | See [Section 8](#8-adding-a-new-tool) |
| Add a sidebar nav link | `features/chat/components/sidebar/sidebar-nav.tsx` |
| Add a system prompt persona | `lib/prompt.ts` |
| Add a DB table | `db/schema.ts` → `pnpm drizzle-kit generate && migrate` |
| Change the default chat model | `lib/ai.ts` → `chatModel` |
| Change tool call limit | `lib/ai.ts` → `maxSteps` |
| Change credit costs | `lib/credits.ts` → `MODEL_CREDIT_COSTS` |
| Change signup bonus | `lib/credits.ts` → `SIGNUP_BONUS_CREDITS` |
| Change max RAG results | `features/quiz/service.ts` → `DEFAULT_GROUNDING_LIMIT` |
