# CLAUDE.md — AI Coder Implementation Guide

This file is read automatically by Claude Code at the start of every session.
It describes how to work in this codebase — conventions, critical rules, and how the pieces fit together.

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
app/                   # Next.js App Router pages & API routes
  api/chat/route.ts    # Main AI chat endpoint — do not refactor lightly
  api/certificate/     # Certificate generation API
  tools/[toolSlug]/    # Dynamic tool pages (quiz, certificate, ...)
  gallery/             # Image gallery page
  models/              # AI models table page
  settings/            # User settings page
  agents/              # Agent builder page
  knowledge/           # Knowledge base page

features/              # Domain feature modules (preferred location for new code)
  chat/                # Chat UI, hooks, and server utilities
    components/
      chat-sidebar.tsx         # Root sidebar component
      sidebar/
        sidebar-nav.tsx        # Nav items (OPTIONAL_NAV_ITEMS)
        sidebar-content.tsx
        sidebar-account.tsx
        sidebar-thread-list.tsx
    hooks/
      use-chat-session.ts      # Core chat state
      use-threads.ts           # Thread CRUD
    server/
      schema.ts                # Zod request/response schemas
      routing.ts               # Model routing logic
      persistence.ts           # DB save operations
  tools/
    registry/
      types.ts                 # ToolManifest, ToolExecutionResult types
      client.ts                # Client-safe registry (manifests only)
      server.ts                # Server registry (imports agent adapters)
  quiz/                        # Quiz/Exam Prep tool
    manifest.ts
    schema.ts
    service.ts                 # CANONICAL LOGIC — all callers use this
    agent.ts                   # Thin AI SDK wrapper → calls service.ts
    types.ts
    components/quiz-tool-page.tsx
  certificate/                 # Certificate Generator tool
    manifest.ts
    schema.ts
    service.ts                 # Re-exports from lib/certificate-service.ts
    agent.ts                   # Thin AI SDK wrapper → calls service.ts
    types.ts
    components/certificate-tool-page.tsx
  gallery/
  models/
  settings/
    components/
      tools-section.tsx        # Enable/disable tools toggles
      memory-section.tsx
      custom-personas-section.tsx
  agents/

lib/                   # Shared utilities and services
  ai.ts                # availableModels, chatModel, ModelOption type
  db.ts                # Drizzle + Neon connection
  auth.ts              # Better Auth setup
  prompt.ts            # System prompts (10 persona types)
  credits.ts           # Credit system
  memory.ts            # User memory extraction/injection
  tool-registry.ts     # Legacy tool registry (kept for DB preference IDs)
  tools/
    index.ts           # buildToolSet() — assembles agent tool set
    exam-prep.ts       # LEGACY — kept for lib/tools.ts backward compat
    certificate.ts     # LEGACY — kept for lib/tools.ts backward compat
    rag.ts             # RAG/knowledge search tools
    weather.ts         # Weather tools
  certificate-service.ts       # Certificate business logic
  certificate-generator.ts     # PDF/PNG generation
  vector-store.ts              # pgvector search
  rag-tool.ts                  # Knowledge base AI SDK tools

db/
  schema.ts            # All Drizzle table definitions
  migrations/          # SQL migration files

components/
  ui/                  # shadcn/ui primitives (30+ components)
  message-renderer/    # Chat message rendering
  ai-elements/         # AI-specific UI components
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
1. features/<toolName>/manifest.ts   ← id, slug, title, icon, category, professions
2. features/<toolName>/schema.ts     ← Zod input/output schemas
3. features/<toolName>/service.ts    ← canonical business logic
4. features/<toolName>/agent.ts      ← thin tool() wrappers calling service
5. features/<toolName>/types.ts      ← exported TypeScript types
6. Register in features/tools/registry/client.ts  (import manifest)
7. Register in features/tools/registry/server.ts  (import agent factory)
8. Add case to app/tools/[toolSlug]/page.tsx
9. Create features/<toolName>/components/<tool>-tool-page.tsx
```

Sidebar, settings toggles, and agent tool builder auto-update from the registry.
No other files need to change.

### 4. Database Changes

After modifying `db/schema.ts`, generate a migration:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

The schema file imports types from `@/lib/certificate-print` — keep those imports intact.

### 5. Imports

Use `@/` alias for all imports (maps to project root).

```typescript
// Correct
import { db } from '@/lib/db';
import { quizManifest } from '@/features/quiz/manifest';

// Wrong
import { db } from '../../../lib/db';
```

---

## Page Layout Pattern

All main pages share this layout structure:

```tsx
// Outer wrapper
<div className="min-h-screen bg-[radial-gradient(...)]">
  // Inner container
  <div className="mx-auto flex max-w-6xl">
    <ChatSidebar ... />
    <main className="rounded-2xl border bg-white/80 dark:bg-zinc-900/80 shadow backdrop-blur">
      {/* page content */}
    </main>
  </div>
</div>
```

---

## AI Chat Route (`app/api/chat/route.ts`)

The main chat endpoint runs in stages:

```
Stage 1  — auth + body parse (parallel)
Stage 2  — DB queries: user, thread, prefs, balance, agent, persona (parallel)
Stage 3  — memory context + persona detection (parallel)
Stage 4  — build system prompt (agent > custom persona > detected persona)
Stage 5  — buildToolSet() with user's enabled tool IDs
Stage 6  — streamText() or generateImage() based on model capabilities
Stage 7  — on finish: persist messages, token usage, follow-up suggestions, memory extraction
```

Key functions used:
- `buildToolSet()` — `lib/tools/index.ts`
- `getSystemPrompt()` — `lib/prompt.ts`
- `detectPersona()` — `lib/persona-detection.ts`
- `extractMemory()` — `lib/memory.ts`
- `getModelByIntent()` — `features/chat/server/routing.ts`
- `saveMessages()` — `features/chat/server/persistence.ts`

---

## Tool System

### Current Tools

| Tool ID | Slug | Agent Tools | Sidebar |
|---------|------|-------------|---------|
| `exam_prep` | `quiz` | generate_practice_quiz, grade_practice_answer, create_study_plan, analyze_learning_gaps, generate_flashcards | `/tools/quiz` |
| `certificate` | `certificate` | list_certificate_templates, preview_certificate_generation, generate_certificate_output, generate_certificate | `/tools/certificate` |
| `knowledge_base` | — | searchKnowledge, retrieveDocument | — |
| `weather` | — | weather, convertFahrenheitToCelsius | — |

### Tool ID vs Slug

- **`id`** — stable identifier used in `userPreferences.enabledToolIds` (DB) and in `lib/tool-registry.ts`
- **`slug`** — URL-safe string used in `/tools/[toolSlug]` routes

The `exam_prep` tool has `id: 'exam_prep'` but `slug: 'quiz'` because the user-facing name is "Quiz".

### buildToolSet()

Located at `lib/tools/index.ts`. Called by the chat API route.

```typescript
buildToolSet({
  enabledToolIds: userPrefs.enabledToolIds ?? ALL_TOOL_IDS,
  userId: session.user.id,
  documentIds: effectiveDocIds,
  rerankEnabled: userPrefs.rerankEnabled,
  source: 'manual',  // or 'agent'
})
```

---

## Database Schema

Key tables in `db/schema.ts`:

| Table | Purpose |
|-------|---------|
| `user` | User accounts |
| `chatThread` | Conversation threads |
| `chatMessage` | Messages (JSONB parts) |
| `userPreferences` | Feature flags, enabled tools, persona settings |
| `userModelPreference` | Per-user enabled model list |
| `certificateTemplate` | User certificate templates |
| `certificateJob` | Certificate generation jobs |
| `document` | RAG documents with 1024-dim vector embeddings |
| `documentChunk` | Chunked documents |
| `userMemory` | Long-term memory facts extracted from chats |
| `agent` | Custom agent definitions |
| `agentShare` | Agent sharing between users |
| `userCredit` | Credit balance per user |
| `creditTransaction` | Transaction log |
| `mediaAsset` | Generated/uploaded images with version history |
| `toolRun` | Persistent tool execution record (sidebar + agent + API) |
| `toolArtifact` | Output files/data from tool runs |

`userPreferences.enabledToolIds` is a `text[]` column storing tool IDs like `['exam_prep', 'certificate']`.

---

## Model Configuration (`lib/ai.ts`)

```typescript
export const chatModel = "google/gemini-2.5-flash-lite"  // default model
export const maxSteps = 5                                 // max tool-call steps

// Model capabilities
type Capability = "text" | "web search" | "image gen" | "embeddings" | "video gen"
```

Models are defined in `availableModels` array. Each has `id`, `name`, `provider`, `capabilities`, `inputCost`, `outputCost`.

Models that don't support tool calls: `toolDisabledModels` set in `features/chat/server/routing.ts`.

---

## Styling

- **Tailwind CSS v4** — no `tailwind.config.js`, config lives in `app/globals.css`
- Colors use **oklch()** color space
- CSS variables: `--background`, `--foreground`, `--primary`, `--sidebar`, etc.
- Dark mode via `.dark` class on `<html>`
- `shadcn/ui` components in `components/ui/` — do not modify these files

Theme variables are in `app/globals.css` under `:root` (light) and `.dark` selectors.

---

## Authentication

Better Auth is configured in `lib/auth.ts` with:
- Magic link email (Resend)
- Google OAuth (optional, checks env vars)
- Session management with IP + UA tracking
- Sign-up bonus credits granted in `onUserCreated` hook

Use `auth.api.getSession({ headers })` on the server to get the current session.

---

## Sidebar Navigation (`features/chat/components/sidebar/sidebar-nav.tsx`)

The sidebar has **optional nav items** that can be toggled and reordered by users:

```typescript
// Current items:
export type SidebarNavItemId = "gallery" | "agents" | "certificate";
export const OPTIONAL_NAV_ITEMS: NavItem[] = [
  { id: "gallery",     href: "/gallery",     label: "Media gallery", ... },
  { id: "agents",      href: "/agents",      label: "Agents",        ... },
  { id: "certificate", href: "/certificate", label: "Certificates",  ... },
];
```

Visibility and order are persisted to `localStorage`:
- `"chat-sidebar-collapsed"` — boolean
- `"chat-sidebar-visible-items"` — `SidebarNavItemId[]`
- `"chat-sidebar-item-order"` — `SidebarNavItemId[]`

To add a new sidebar nav item, add an entry to `OPTIONAL_NAV_ITEMS` and extend `SidebarNavItemId`.

---

## Credits System (`lib/credits.ts`)

- `getUserBalance(userId)` — returns current balance
- `deductCredits(userId, amount, modelId, threadId)` — deducts with transaction log
- `getCreditCost(modelId)` — cost per request by model
- `SIGNUP_BONUS_CREDITS = 100`

The chat route checks balance before streaming. If insufficient: returns 402 error.

---

## System Prompts & Personas (`lib/prompt.ts`)

10 built-in persona keys:
`general_assistant`, `coding_copilot`, `product_manager`, `friendly_tutor`, `data_analyst`, `summarizer_editor`, `security_privacy_guard`, `research_librarian`, `translation_localization`, `troubleshooting_debugger`

Priority order for system prompt selection:
1. Agent system prompt (if `agentId` in request)
2. Custom persona (user-created, from `customPersona` table)
3. Auto-detected persona (`lib/persona-detection.ts`)
4. Default: `general_assistant`

---

## RAG / Knowledge Base

- Documents stored in `document` table with pgvector embeddings (1024-dim, Mistral model)
- Search: `searchDocumentsByIds(query, documentIds, { limit, rerank })` — `lib/vector-store.ts`
- Reranking: Cohere cross-encoder (optional, `userPrefs.rerankEnabled`)
- Chunked docs: `documentChunk` table for large files

---

## Certificate System

The heavy logic lives in `lib/certificate-service.ts` (622 lines). `features/certificate/service.ts` re-exports from it.

Key exported functions:
- `generateCertificateOutput({ userId, templateId, recipients, format, outputMode, source })`
- `previewCertificateGeneration({ userId, templateId, recipients, format, outputMode })`
- `listUserCertificateTemplates(userId)`

Output modes: `single_file` | `zip` | `single_pdf` | `sheet_pdf`
Formats: `png` | `jpg` | `pdf`

Generated files are uploaded to Cloudflare R2. Jobs are tracked in `certificateJob` table.

---

## Tool Execution Persistence

New tables added for tracking tool runs across sidebar and agent:

```typescript
// toolRun — every tool execution
{ id, toolSlug, userId, threadId, source, inputJson, outputJson, status, createdAt }

// toolArtifact — output files/data
{ id, toolRunId, kind, format, storageUrl, payloadJson, createdAt }
```

`source` values: `'sidebar'` | `'agent'` | `'api'`

---

## Common Patterns

### Server Component Data Fetching
```typescript
// Parallel DB queries pattern used throughout
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

### Route Handler Auth Check
```typescript
const session = await auth.api.getSession({ headers: req.headers });
if (!session?.user) return new Response('Unauthorized', { status: 401 });
```

### Zod Validation in API Routes
```typescript
const body = await req.json();
const result = requestSchema.safeParse(body);
if (!result.success) return new Response('Bad Request', { status: 400 });
const { threadId, messages } = result.data;
```

---

## What NOT to Do

- Do not use `npm` or `bun` — always `pnpm`
- Do not add business logic to `agent.ts` — it belongs in `service.ts`
- Do not import `service.ts` or `agent.ts` in client components
- Do not modify files in `components/ui/` (shadcn primitives)
- Do not add `useEffect` for data fetching — use TanStack Query
- Do not hardcode user IDs or model IDs — use constants from `lib/ai.ts` and `lib/tool-registry.ts`
- Do not skip the Zod validation layer in API routes
- Do not use `any` type in TypeScript
- Do not `git push --force` to main

---

## Environment Variables (required)

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
GOOGLE_CLIENT_ID          # Optional — Google OAuth
GOOGLE_CLIENT_SECRET      # Optional
COHERE_API_KEY            # Optional — reranking
```
