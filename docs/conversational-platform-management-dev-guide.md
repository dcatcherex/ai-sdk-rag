# Conversational Platform Management — Developer & AI Coder Guide

Users should be able to manage their Vaja AI workspace through natural conversation — not just through the web UI. This guide covers the architecture, file map, tool contracts, channel-specific behaviors, and implementation phases for enabling platform management via chat on both the web app and LINE.

Read this before implementing any platform management tool, the Vaja Platform Agent, conversational onboarding, or cross-channel thread continuity.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Core Concept: The Vaja Platform Agent](#2-core-concept-the-vaja-platform-agent)
3. [User Types and Access Patterns](#3-user-types-and-access-patterns)
4. [Architecture Overview](#4-architecture-overview)
5. [Platform Management Tools](#5-platform-management-tools)
6. [API Routes](#6-api-routes)
7. [Service Layer](#7-service-layer)
8. [Conversational Onboarding Flow](#8-conversational-onboarding-flow)
9. [Thread Continuity Across Channels](#9-thread-continuity-across-channels)
10. [LINE Management Bot (Owner Personal LINE)](#10-line-management-bot-owner-personal-line)
11. [Database Schema Changes](#11-database-schema-changes)
12. [Tool Registration](#12-tool-registration)
13. [Channel-Specific Behavior Rules](#13-channel-specific-behavior-rules)
14. [File-By-File Implementation Map](#14-file-by-file-implementation-map)
15. [Implementation Phases](#15-implementation-phases)
16. [Common Mistakes and Gotchas](#16-common-mistakes-and-gotchas)
17. [Testing Guidance](#17-testing-guidance)

---

## 1. Problem Statement

The web app is the control room. It requires the user to navigate to the right screen, open a form, fill out fields, and save. For Thai users who spend most of their time in LINE, this is an unnecessary detour.

The current chat is excellent for domain tasks (content, research, customer service) but has no awareness of the platform itself. A user cannot say "สร้าง agent ใหม่" (create a new agent) in chat and have it happen.

Three things are missing:

1. **Platform management tools** — the AI has no tools to create agents, install skills, start threads, or manage the workspace.
2. **Vaja Platform Agent** — no dedicated agent exists whose job is platform management and onboarding.
3. **Cross-channel thread continuity** — a thread started on web cannot be referenced or resumed from LINE.

### What is already built (do not re-implement)

Before starting, be aware that the LINE multi-agent switching system is **fully implemented**. Do not rebuild any of this:

| What | Where | Status |
|------|-------|--------|
| Per-user agent session | `lineUserAgentSession` table in `db/schema/line-oa.ts` | ✅ Done |
| Agent resolution priority (session → channel default) | `features/line-oa/webhook/index.ts` lines 152–154 | ✅ Done |
| `switch_agent:<agentId>` postback handling | `features/line-oa/webhook/events/postback.ts` | ✅ Done |
| Rich menu `switch_agent` action type in web UI | `features/line-oa/components/rich-menu-editor.tsx` lines 328–391 | ✅ Done |
| Rich menu `switch_menu:<id>` postback handling | `features/line-oa/webhook/events/postback.ts` | ✅ Done |

What the `config_rich_menu` platform tool adds on top of this is **conversational triggering** — letting the owner say "change button 2 to the Sales Agent" in LINE chat instead of opening the web UI. The underlying data layer and web UI are already correct.

---

## 2. Core Concept: The Vaja Platform Agent

The Vaja Platform Agent is a **built-in, non-deletable agent** reserved with a well-known ID (`vaja-platform`). Its job is to help users set up and manage their workspace through conversation.

It is distinct from domain agents (customer service, teacher, farmer). It is a **meta-agent** — it knows the platform, not a domain.

### What makes it different from other agents

| Dimension | Domain Agent | Vaja Platform Agent |
|-----------|-------------|---------------------|
| Skills | Domain skills (farming, teaching) | Platform management tools only |
| Memory | User's business context | User's workspace configuration |
| Tools | Domain tools (quiz, certificate, search) | createAgent, installSkill, createThread, listAgents |
| System prompt | Business persona | Platform expert, onboarding guide |
| Who uses it | End customers (via LINE OA) | Workspace owner / team admin |
| Deletable | Yes | No — reserved agent |

### Activation contexts

The Vaja Platform Agent activates when:
- A new user has no agents configured yet (web onboarding)
- A workspace owner messages the Vaja Management LINE OA
- A user types `/platform` or `/setup` in any chat
- A team admin accesses the shared workspace for the first time

---

## 3. User Types and Access Patterns

There are two distinct user types for this feature. Do not conflate them.

### Type A — Workspace Owner (via LINE or web)

The person who owns the Vaja account and LINE OA. They set up agents, install skills, manage credits, and configure the workspace.

**Access patterns:**
- Web app (control room) — always available
- Personal LINE → Vaja Management Bot — LINE-native management
- `/platform` slash command in any chat thread

**Tasks they perform via conversation:**
- Create a new agent
- Install a skill from community or GitHub
- Create a new thread with a specific agent
- Review credit usage
- Configure rich menu for a LINE OA channel
- Add a team member

### Type B — Team Member (shared workspace, web only)

A person who shares credits from the owner. They can use the workspace but may not have admin rights.

**Access patterns:**
- Web app only (no Management LINE OA access unless granted)
- The default assistant helps them navigate available agents

**Tasks they perform via conversation:**
- Find the right agent for their task
- Start a new thread
- Ask what skills are available
- Continue a previous conversation

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLATFORM MANAGEMENT LAYER                         │
│                                                                     │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐  │
│  │  Vaja Platform Agent  │     │   Conversational Onboarding      │  │
│  │  (reserved agent ID)  │     │   (new user, no agents yet)      │  │
│  └──────────┬───────────┘     └──────────────┬───────────────────┘  │
│             │                                │                       │
│             ▼                                ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Platform Management Tools                        │   │
│  │                                                              │   │
│  │  createAgent  installSkill  listAgents   createThread        │   │
│  │  listSkills   searchSkills  continueThread  getUsage         │   │
│  │  addTeamMember configRichMenu                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│             │                                                         │
│             ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │             features/platform-agent/service.ts               │   │
│  │             (canonical business logic)                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Existing API routes        │   │  Thread continuity service    │  │
│  │  /api/agents               │   │  (find + resume threads)      │  │
│  │  /api/skills               │   │  cross-channel linking        │  │
│  │  /api/chat/threads         │   └──────────────────────────────┘  │
│  └────────────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────┘

Channel Layer
  Web App Chat      ←→  Vaja Platform Agent via /api/chat/route.ts
  LINE Mgmt Bot     ←→  Vaja Platform Agent via LINE webhook
```

### Data flow for a management request

```
User message: "สร้าง agent ลูกค้าสัมพันธ์ ร้านขายยา"
        │
        ▼
app/api/chat/route.ts (or LINE webhook)
        │
        │  resolves to Vaja Platform Agent (vaja-platform reserved ID)
        │
        ▼
buildToolSet() includes platform management tools
        │
        ▼
LLM calls createAgent({ name, systemPrompt, description, ... })
        │
        ▼
features/platform-agent/agent.ts
        │  thin wrapper → service.ts
        ▼
features/platform-agent/service.ts
        │  calls existing /api/agents mutation logic (not the route, the service function)
        ▼
Agent created in DB → response to user
```

---

## 5. Platform Management Tools

All tools follow the CLAUDE.md tool architecture. Logic lives in `service.ts`. The `agent.ts` file is a thin AI SDK `tool()` wrapper only.

### Tool list

| Tool name | What it does | Zod input key fields |
|-----------|-------------|----------------------|
| `create_agent` | Creates a new agent for the user | `name`, `systemPrompt`, `description`, `modelId?`, `skillIds?` |
| `list_agents` | Returns the user's agents | `includeDefault?`, `limit?` |
| `get_agent` | Gets details of a specific agent | `agentId` or `agentName` |
| `install_skill` | Installs a community or GitHub skill | `skillId?`, `githubUrl?`, `agentId?` |
| `list_skills` | Lists skills available to the user | `category?`, `source?` |
| `search_skills` | Searches community skill catalog | `query` |
| `create_thread` | Opens a new chat thread | `agentId?`, `title?`, `initialMessage?` |
| `list_threads` | Recent threads with context summaries | `limit?`, `agentId?` |
| `continue_thread` | Loads context from a named/recent thread | `threadId?`, `topic?` |
| `get_usage` | Returns credit balance and recent usage | — |
| `add_team_member` | Shares workspace access | `email`, `creditsToShare?` |
| `config_rich_menu` | Conversationally updates a rich menu button's agent assignment (web UI already supports this visually; this tool enables it via chat) | `channelId`, `buttonIndex`, `agentId`, `confirmed?` |

### Tool definition contract

Every platform management tool returns:

```typescript
type PlatformToolResult = {
  success: boolean;
  message: string;          // Human-readable result in Thai or English
  data?: Record<string, unknown>;
  actionUrl?: string;       // Web deep-link for "view in app" affordance
};
```

The `actionUrl` is important. When a user creates an agent via LINE, the response includes:
```
"สร้างแล้วครับ ✓ ดู/แก้ไขได้ที่: https://app.vaja.ai/agents/[id]"
```

---

## 6. API Routes

Platform management tools do not introduce new API routes for the tools themselves — they reuse existing service functions from `features/agents/`, `features/skills/`, etc.

However, two new API routes are needed:

### `POST /api/platform-agent/onboard`

Handles the first-time onboarding flow. Called when a new user has no agents.

```typescript
// Request
{
  professionHint: string;       // e.g. "ครู", "ร้านอาหาร", "ฟาร์มเกษตร"
  language?: 'th' | 'en';
}

// Response
{
  agentId: string;
  agentName: string;
  skillsInstalled: string[];
  suggestedStarters: string[];
}
```

### `GET /api/platform-agent/context`

Returns a snapshot of the user's workspace for the platform agent to use as system context injection:

```typescript
// Response
{
  agentCount: number;
  skillCount: number;
  threadCount: number;
  creditBalance: number;
  lineOaConnected: boolean;
  recentAgents: Array<{ id: string; name: string }>;
  recentThreads: Array<{ id: string; title: string; agentName: string; updatedAt: string }>;
}
```

This is injected into the Vaja Platform Agent's system prompt at runtime — not fetched by the user.

---

## 7. Service Layer

```
features/platform-agent/
  manifest.ts         ← tool manifest (id: "platform_agent", supportsAgent: true)
  schema.ts           ← Zod schemas for all tool inputs/outputs
  service.ts          ← canonical business logic (all management operations)
  agent.ts            ← AI SDK tool() wrappers calling service.ts
  types.ts            ← PlatformToolResult, OnboardingPlan, WorkspaceContext
  prompts.ts          ← system prompt builder for the Vaja Platform Agent
  onboarding.ts       ← profession → agent template + skill mapping
```

### `service.ts` function signatures

```typescript
// Agent management
export async function createAgentForUser(
  userId: string,
  input: CreateAgentInput
): Promise<PlatformToolResult>

export async function listAgentsForUser(
  userId: string,
  opts?: { limit?: number; includeDefault?: boolean }
): Promise<PlatformToolResult>

// Skill management
export async function installSkillForUser(
  userId: string,
  input: InstallSkillInput
): Promise<PlatformToolResult>

export async function searchCommunitySkills(
  query: string
): Promise<PlatformToolResult>

// Thread management
export async function createThreadForUser(
  userId: string,
  input: CreateThreadInput
): Promise<PlatformToolResult>

export async function findRelevantThread(
  userId: string,
  input: { topic?: string; threadId?: string; agentId?: string }
): Promise<PlatformToolResult>

// Workspace context
export async function getWorkspaceContext(
  userId: string
): Promise<WorkspaceContext>

// Onboarding
export async function runOnboardingPlan(
  userId: string,
  professionHint: string
): Promise<OnboardingPlan>

// Credit management
export async function getUserUsageSummary(
  userId: string
): Promise<PlatformToolResult>
```

### Critical rule: service.ts must not call API routes

`service.ts` calls Drizzle DB queries and existing service functions directly. It must never call `fetch('/api/agents')` or any HTTP route. Import from the existing feature services instead:

```typescript
// Correct
import { db } from '@/lib/db';
import { agent } from '@/db/schema/agents';
import { agentSkill } from '@/db/schema/skills';

// Wrong
await fetch('/api/agents', { method: 'POST', ... });
```

---

## 8. Conversational Onboarding Flow

This triggers when a user has zero agents and opens the web chat for the first time, or follows the Vaja Management LINE OA for the first time.

### Detection

In `app/api/chat/route.ts`, during Stage 2 (DB queries):

```typescript
const agentCount = await db
  .select({ count: count() })
  .from(agent)
  .where(eq(agent.userId, userId));

const isFirstTimeUser = agentCount[0].count === 0;
```

If `isFirstTimeUser` is true, override the agent resolution to always use `vaja-platform`.

### Onboarding conversation script

The system prompt for onboarding mode includes:

```
You are the Vaja AI setup assistant. This user has no agents yet.
Your job is to ask ONE question: what kind of work they do.
Then call runOnboarding() with their answer to set up their workspace.
Keep responses short. After setup is complete, introduce the user to
their new agent and suggest 2-3 starter prompts in Thai.
```

### Profession → workspace mapping

Defined in `features/platform-agent/onboarding.ts`:

```typescript
type ProfessionTemplate = {
  agentName: string;
  systemPrompt: string;
  skillSuggestions: string[];   // community skill IDs to auto-install
  starterPrompts: string[];
};

const PROFESSION_MAP: Record<string, ProfessionTemplate> = {
  ครู: {
    agentName: 'ผู้ช่วยครู',
    systemPrompt: 'คุณเป็นผู้ช่วยสอนที่เชี่ยวชาญการวางแผนบทเรียนและสร้างแบบทดสอบ...',
    skillSuggestions: ['lesson-plan', 'exam-creator'],
    starterPrompts: [
      'ช่วยวางแผนบทเรียนเรื่อง...',
      'สร้างแบบทดสอบ 10 ข้อสำหรับ...',
    ],
  },
  ร้านอาหาร: {
    agentName: 'ผู้ช่วยร้านอาหาร',
    systemPrompt: 'คุณเป็นผู้ช่วยธุรกิจร้านอาหาร ตอบคำถามลูกค้า เขียนเมนู ช่วยการตลาด...',
    skillSuggestions: ['customer-service', 'content-marketing'],
    starterPrompts: [
      'เขียนโพสต์ Instagram แนะนำเมนูใหม่',
      'ร่างข้อความตอบลูกค้าที่ถามเรื่องโต๊ะ',
    ],
  },
  // ... more profession templates
};
```

### Onboarding result delivery

After `runOnboardingPlan()` completes, the platform agent responds in chat with:

```
ตั้งค่าเรียบร้อยแล้วครับ 🎉

สร้าง Agent: "ผู้ช่วยครู" ✓
ติด Skill: Lesson Planner ✓
ติด Skill: Exam Creator ✓

ลองถามอะไรก็ได้ครับ เช่น:
• "ช่วยวางแผนบทเรียนเรื่องประวัติศาสตร์ไทย ป.5"
• "สร้างแบบทดสอบ 10 ข้อ เรื่องคณิตศาสตร์พื้นฐาน"
```

---

## 9. Thread Continuity Across Channels

Users start conversations on web and want to resume them on LINE (or vice versa). The thread must survive channel switches.

### Current state

Threads are already stored in the DB (`chatThread` table) and linked to `userId`. The problem is that LINE conversations go to `lineConversation` which maps to a `chatThread`, but there is no easy way to find a thread by topic or context from another channel.

### What to build

A `findRelevantThread()` function in `service.ts` that:

1. Searches thread titles and recent message summaries by keyword
2. Falls back to "most recent thread with the same agent"
3. Returns the thread ID plus a brief context summary for the AI

```typescript
export async function findRelevantThread(
  userId: string,
  input: { topic?: string; threadId?: string; agentId?: string }
): Promise<PlatformToolResult> {
  if (input.threadId) {
    // Direct lookup
  }
  if (input.topic) {
    // Full-text search on chatThread.title + last message snippet
    // Use DB ILIKE or pg_trgm if available
  }
  // Fallback: most recent thread
}
```

### LINE → Web deep link

When a user resumes a thread via LINE, the bot includes a deep link:

```
พบ conversation เดิมครับ: "แคมเปญ Summer Sale"
อ่านต่อได้ที่: https://app.vaja.ai/chat?thread=[id]

หรือจะคุยต่อที่นี่เลยก็ได้ครับ สรุปจากครั้งก่อน:
[AI-generated 2-sentence summary of last thread state]
```

The summary is generated by the platform agent, not stored — it is produced on demand from the last N messages of that thread.

### Web → LINE notification

When the platform agent creates or continues a thread on the web, it can optionally notify the user on LINE if `lineConversation` is linked:

```typescript
// Only if user has linked LINE account
if (linkedLineUserId && lineOaChannelId) {
  await sendLineMessage(linkedLineUserId, lineOaChannelId, {
    type: 'text',
    text: `มี thread ใหม่: "${thread.title}" — คุยต่อได้บน LINE ได้เลยครับ`,
  });
}
```

---

## 10. LINE Management Bot (Owner Personal LINE)

This is a **separate LINE OA channel** that the business owner follows with their personal LINE account. It is not the customer-facing LINE OA. It talks to the Vaja Platform Agent on behalf of the authenticated owner.

### Channel resolution

The LINE Management Bot webhook resolves the owner via account linking (`lineConversation.linkedUserId`). If not linked, it replies with a link token to connect their Vaja account.

```
features/line-oa/webhook/management-bot.ts   ← new handler for management OA events
```

This handler is separate from the customer-facing `events/message.ts`. Do not merge them.

### Agent resolution for management bot

Unlike customer-facing channels (where the channel config resolves the agent), the management bot always resolves to `vaja-platform` agent. No override.

```typescript
// management-bot.ts
const effectiveAgentId = 'vaja-platform'; // always
```

### Platform tools available via LINE

All platform management tools listed in Section 5 are available via LINE, but the `config_rich_menu` tool must do extra validation since it affects the customer-facing LINE OA.

Rich menu changes via LINE chat should go through a **confirmation step**:

```
Agent: คุณต้องการเปลี่ยนปุ่มที่ 2 จาก "คำถามทั่วไป" เป็น "โปรโมชั่น" ใช่ไหมครับ?
User: ใช่
Agent: [calls config_rich_menu with confirmed=true]
```

Add `confirmed: boolean` to the `config_rich_menu` tool input and return an intermediate confirmation step when `confirmed` is false.

### Character limits for LINE responses

LINE messages have a 5,000-character limit per bubble. The platform agent system prompt must include:

```
When responding via LINE, keep each response under 400 characters.
For lists (agents, skills, threads), show at most 3 items.
Always offer to continue via the web app for complex operations.
```

Detect the channel in `management-bot.ts` and inject this constraint into the context passed to the chat route.

---

## 11. Database Schema Changes

Minimal schema changes are needed. The platform agent reuses existing tables.

### New: `platform_agent_session` (optional, Phase 3)

Only needed if the onboarding state must persist across sessions:

```sql
-- db/migrations/XXXX_platform_agent_session.sql
CREATE TABLE platform_agent_session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_profession TEXT,
  onboarding_completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**However**, for Phase 1, use `userPreferences` (already exists) and add a `onboardingComplete` flag to the existing JSONB preferences field. This avoids a migration.

### Existing tables used

| Table | Used for |
|-------|---------|
| `agent` | Creating and listing agents |
| `agentSkill` | Installing and listing skills |
| `agentSkillAttachment` | Attaching skills to the new agent |
| `chatThread` | Creating and finding threads |
| `chatMessage` | Reading recent context for thread summaries |
| `userCredit` | Reading credit balance |
| `lineConversation` | Cross-channel thread lookup |
| `lineUserAgentSession` | Already exists — per-user active agent override for LINE; `config_rich_menu` reads this to report current state |
| `lineRichMenu` | Already exists — reading current rich menu areas to propose changes |
| `userPreferences` | Reading enabled tools, onboarding state |

---

## 12. Tool Registration

### In `features/tools/registry/client.ts`

Add the platform agent manifest. The platform agent does not have a sidebar tool page, so `supportsSidebar: false`.

```typescript
import { platformAgentManifest } from '@/features/platform-agent/manifest';

// Add to CLIENT_REGISTRY
platformAgentManifest,
```

### In `features/tools/registry/server.ts`

Register the agent definition (tools only, not the manifest twice):

```typescript
import { getPlatformAgentTools } from '@/features/platform-agent/agent';

// Add to SERVER_REGISTRY
{
  manifest: platformAgentManifest,
  getAgentDefinition: (context) => getPlatformAgentTools(context),
  getSidebarPageHref: () => '/',   // no sidebar page
},
```

### In `lib/tools/index.ts`

The platform agent tools are registered through the server registry and automatically picked up by `buildRegistryAgentTools()`. No changes needed to `index.ts`.

### In `app/api/chat/route.ts`

Two injection points need updating:

**1. Agent resolution (Stage 2):**

```typescript
// After fetching agent from DB, check if it's vaja-platform or if first-time user
const isFirstTimeUser = agentCount[0].count === 0 && !agentId;
const effectiveAgentId = isFirstTimeUser ? 'vaja-platform' : agentId;
```

**2. Context injection (Stage 5):**

```typescript
// When effectiveAgentId === 'vaja-platform', fetch and inject workspace context
if (effectiveAgentId === 'vaja-platform') {
  const workspaceCtx = await getWorkspaceContext(userId);
  systemPrompt += buildWorkspaceContextBlock(workspaceCtx);
}
```

The workspace context block format:

```
<workspace_context>
agents: 3 (General Assistant, Customer Service Bot, Content Writer)
skills: 5
threads: 12
credit_balance: 84
line_oa_connected: true
recent_threads:
  - "แคมเปญ Summer Sale" (Content Writer, 2h ago)
  - "ตอบคำถามลูกค้า" (Customer Service Bot, 1d ago)
</workspace_context>
```

---

## 13. Channel-Specific Behavior Rules

### Rule 1: Platform agent is owner-only

The platform management tools must check that the requesting user owns the workspace being modified. Never allow a team member with shared credits to delete agents or modify the LINE OA.

```typescript
// In service.ts
if (agent.userId !== userId) {
  return { success: false, message: 'คุณไม่มีสิทธิ์แก้ไข agent นี้' };
}
```

### Rule 2: Never import platform agent tools into customer-facing LINE OA

The customer-facing LINE OA webhook (`features/line-oa/webhook/events/message.ts`) loads tools via `buildToolSet()` with the channel's agent config. That agent config must never include `platform_agent` as an enabled tool. Platform tools are only loaded when `effectiveAgentId === 'vaja-platform'`.

### Rule 3: Destructive operations require confirmation

Any tool that deletes data (future: `delete_agent`, `delete_skill`, `delete_thread`) must include a `confirmed: boolean` field and return a confirmation prompt when `confirmed` is false. Never delete on first call.

### Rule 4: Rich menu changes are not instant

`config_rich_menu` calls the LINE Messaging API which can fail. Always handle errors and report back. Do not assume success.

### Rule 5: Thread creation via platform agent does not replace the chat

When `create_thread` is called and `initialMessage` is provided, the tool creates the thread record and returns a deep link. It does not pipe the `initialMessage` into the chat route — that would create a double-send. The user clicks the link to open the thread themselves.

---

## 14. File-By-File Implementation Map

### New files

```
features/platform-agent/
  manifest.ts                   ← id: "platform_agent", slug: "platform-agent"
  schema.ts                     ← Zod schemas for all 11 tool inputs/outputs
  types.ts                      ← PlatformToolResult, WorkspaceContext, OnboardingPlan
  service.ts                    ← all canonical management operations
  agent.ts                      ← AI SDK tool() wrappers
  prompts.ts                    ← buildPlatformAgentSystemPrompt(context)
                                   buildOnboardingSystemPrompt()
                                   buildWorkspaceContextBlock(ctx)
  onboarding.ts                 ← PROFESSION_MAP + runOnboardingPlan()

app/api/platform-agent/
  onboard/route.ts              ← POST: first-time onboarding trigger
  context/route.ts              ← GET: workspace snapshot for system prompt

features/line-oa/webhook/
  management-bot.ts             ← New: handles management LINE OA events
```

### Existing files to modify

```
app/api/chat/route.ts
  Stage 2: detect first-time user, resolve to vaja-platform
  Stage 5: inject workspace context block when vaja-platform is active

features/tools/registry/client.ts
  Add: platformAgentManifest import + registration

features/tools/registry/server.ts
  Add: getPlatformAgentTools import + registration

app/api/line/[channelId]/route.ts
  Add: branch for management bot channel ID → management-bot.ts handler
```

### Files NOT to modify

```
lib/tools/index.ts                                    ← buildRegistryAgentTools() handles it automatically
components/ui/*                                       ← shadcn primitives, never touch
features/chat/server/routing.ts                       ← platform agent doesn't use intent routing
features/line-oa/components/rich-menu-editor.tsx      ← switch_agent UI already fully implemented
features/line-oa/webhook/events/postback.ts           ← switch_agent and switch_menu postbacks already handled
db/schema/line-oa.ts (lineUserAgentSession table)     ← already exists, no migration needed
```

---

## 15. Implementation Phases

### Phase 1 — Platform Agent Foundation (Web Only) ✅ DONE

Goal: the Vaja Platform Agent works in the web chat with the five most valuable tools.

**Deliverables:**
- ✅ `features/platform-agent/` module (manifest, schema, types, service, agent, prompts)
- ✅ Tools: `create_agent`, `list_agents`, `get_agent`, `install_skill`, `list_skills`, `get_usage`, `create_thread`, `list_threads`, `continue_thread`
- ✅ Agent resolution in `app/api/chat/route.ts` for `vaja-platform` reserved ID and first-time user detection
- ✅ Workspace context injection into system prompt
- ✅ `GET /api/platform-agent/context` route
- ✅ Registered in `features/tools/registry/client.ts` and `server.ts`

**Implementation notes:**
- Platform agent activates when: `agentId === 'vaja-platform'` OR user has 0 user-owned agents
- When `isPlatformAgentActive`, platform tools are loaded exclusively (Rule 2 enforced)
- No DB record required for the reserved agent — resolved synthetically in the chat route

**Acceptance criteria:**
- User can type "สร้าง agent ใหม่ สำหรับร้านกาแฟ" and have an agent created ✅
- User can type "มีสกิลอะไรบ้าง" and see their installed skills ✅
- User can type "เครดิตเหลือเท่าไหร่" and get their balance ✅
- No platform tools are exposed to non-platform agents ✅

---

### Phase 2 — Conversational Onboarding ✅ DONE

Goal: new users with zero agents are onboarded through conversation, not a UI form.

**Deliverables:**
- ✅ `features/platform-agent/onboarding.ts` with profession map (6 professions: ครู, ร้านอาหาร, เกษตรกร, นักธุรกิจ, นักพัฒนา, สุขภาพ + generic fallback)
- ✅ `POST /api/platform-agent/onboard` route
- ✅ First-time user detection in chat route (`isOnboardingMode` flag)
- ✅ Onboarding system prompt (`buildOnboardingSystemPrompt()`) + workspace context prompt (`buildPlatformAgentSystemPrompt()`)

**Implementation notes:**
- "onboardingComplete" is implicit: once a user has ≥1 agent, `isOnboardingMode` becomes false naturally
- No schema migration needed — agent count used as proxy
- `runOnboardingPlan()` in service.ts creates agent + skills in one call

**Acceptance criteria:**
- New user opens chat and is greeted by Vaja Platform Agent ✅
- After one question and answer, their workspace is configured (agent + 2 skills) ✅
- Agent responds with starter prompts in Thai ✅
- On second session, normal chat resumes (not onboarding again) ✅

---

### Phase 3 — Thread Continuity ✅ DONE (core)

Goal: users can reference and resume threads by topic across sessions.

**Deliverables:**
- ✅ `findRelevantThread()` in service.ts — direct ID lookup, topic ILIKE search, fallback to most recent
- ✅ `continue_thread` tool
- ✅ `create_thread` tool
- ✅ `list_threads` tool

**Remaining (Phase 5):** AI-generated thread summary, cross-channel (LINE↔web) lookup

**Acceptance criteria:**
- User types "ต่อจาก conversation เรื่อง marketing" and the agent loads that thread context ✅
- User types "เริ่ม thread ใหม่เรื่องงบประมาณ กับ agent ที่วางแผนได้" and a thread is created ✅
- Thread summary (2 sentences) is generated on demand, not stored ⬜ (Phase 5)

---

### Phase 4 — LINE Management Bot ✅ DONE

Goal: workspace owners can manage Vaja via their personal LINE.

**Deliverables:**
- ✅ `features/line-oa/webhook/management-bot.ts` — dedicated handler for channel owner messages
- ✅ Management bot routing in `features/line-oa/webhook/index.ts` — detects owner via `linkedUser.userId === channel.userId`, routes to management bot (not merged with customer handler)
- ✅ All Phase 1–3 tools available via LINE (reuses `getPlatformAgentTools`)
- ✅ `config_rich_menu` tool — 2-step (preview then confirmed) updates rich menu area action in DB + instructs user to redeploy from web UI
- ✅ `add_team_member` tool — user lookup by email + credit transfer with confirmation
- ✅ LINE 400-char constraint injected via `LINE_PLATFORM_CONSTRAINT` in `prompts.ts`
- ✅ `features/line-oa/webhook/events/postback.ts` switch_agent and approval strings converted to Thai

**Implementation notes:**
- Management bot activates without a separate LINE OA — owner is detected by account link (`linkedUser.userId === channel.userId`)
- Group chats never activate management bot even if owner is a member (Rule 3 safety)
- `config_rich_menu` updates DB only; user must redeploy from web UI (LINE API image gen is expensive)
- Dynamic imports in `service.ts` for schema/credits avoid circular dependency issues

**Acceptance criteria:**
- Owner messages their own OA, links account → routes to management bot ✅
- Owner can create an agent via LINE chat ✅
- Owner can configure rich menu button with confirmation step ✅
- Tool responses ≤400 chars with action URLs ✅
- Customer-facing LINE OA channels are not affected ✅

---

### Phase 5 — Cross-Channel Thread Continuity ✅ DONE

Goal: threads started on web can be referenced and continued on LINE and vice versa.

**Deliverables:**
- ✅ `findRelevantThreadWithContext()` in service.ts — 3-tier lookup: direct ID → title ILIKE → `lineConversation` cross-join → most-recent fallback
- ✅ `getThreadContextSummary()` — generates 2-sentence AI summary from last 10 messages on demand (not stored)
- ✅ `continue_thread` tool updated to use the enhanced cross-channel lookup
- ✅ `notifyLinkedLineUsers()` — sends LINE push to all linked accounts via `lineAccountLink` + `lineOaChannel.channelAccessToken`
- ✅ `createThreadForUser()` fires push notification (fire-and-forget) when a web thread is created
- ✅ Management bot appends `actionUrl` deep links to tool results (LINE → Web)

**Acceptance criteria:**
- Owner starts a thread on web → LINE push notification sent ✅
- Owner resumes via LINE management bot typing topic → finds thread, returns 2-sentence summary + deep link ✅
- Owner can send message to thread from LINE → saved to same `chatThread` → visible on web ✅

---

## 16. Common Mistakes and Gotchas

### Mistake 1: Calling API routes from service.ts

`service.ts` must import and call service functions or Drizzle queries directly. Calling HTTP routes from server code creates circular dependencies and adds latency.

### Mistake 2: Adding platform tools to all agents

Platform management tools must only be loaded when `effectiveAgentId === 'vaja-platform'`. The `buildToolSet()` call in `app/api/chat/route.ts` should gate these tools on the agent ID, not on user preferences.

### Mistake 3: Merging management bot with customer bot

The management LINE OA handler (`management-bot.ts`) and the customer-facing handler (`events/message.ts`) must stay separate. They have different agent resolution logic, different tool sets, and different security requirements.

### Mistake 4: Persisting onboarding messages as chat history

The onboarding conversation should be persisted as a normal chat thread (so the user has history), but the system prompt should mark the thread as `onboarding` type. Do not use a special one-off table. Use an existing column or `userPreferences.onboardingComplete`.

### Mistake 5: Auto-publishing or auto-deleting on first call

Any tool that modifies shared state (rich menu, team members) must include a confirmation step. Return a proposed plan first, then execute on a second call with `confirmed: true`.

### Mistake 6: Forgetting to seed the reserved agent

The `vaja-platform` agent must be seeded in the database as a system agent (not user-owned). It should not appear in the user's agent list. Add it to the DB seed script or as an upsert in the migration.

```sql
INSERT INTO agent (id, user_id, name, system_prompt, ..., is_default, managed_by_admin, created_at, updated_at)
VALUES ('vaja-platform', NULL, 'Vaja Platform Agent', '...', ..., false, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

### Mistake 7: Rebuilding the LINE agent-switch mechanism

`lineUserAgentSession`, the `switch_agent` postback handler, and the rich menu `switch_agent` UI are all already shipped. The `config_rich_menu` platform tool only needs to call the LINE Messaging API to update the menu image/areas — the per-user session switching is handled automatically by the existing postback flow after that.

Do not write a new session management layer. Do not add another `switch_agent` handler.

The one cosmetic gap that is acceptable to fix: the confirmation message in `postback.ts` is in English (`"Switched to ..."`) and should be Thai. Change the strings in `features/line-oa/webhook/events/postback.ts` to Thai when you touch that file.

### Mistake 8: Over-engineering the profession map

Start with 5–8 professions based on the target user segments in `docs/vaja-vision.md`. Do not build an exhaustive taxonomy. Missing professions fall back to a generic workspace setup.

---

## 17. Testing Guidance

### Unit tests

- Schema validation for all 11 tool inputs (do not test `switch_agent` postback — already covered by existing LINE webhook tests)
- `onboarding.ts` profession map lookup (known profession → correct template, unknown → fallback)
- `buildWorkspaceContextBlock()` output format
- `findRelevantThread()` with mock thread data

### Integration tests

- `POST /api/platform-agent/onboard` — creates agent and skill records in test DB
- `GET /api/platform-agent/context` — returns correct counts for a seeded user
- Auth rejection on all routes
- `create_agent` tool via chat API — agent appears in DB after tool call completes

### End-to-end scenarios

- **New user onboarding**: open chat → receive greeting → answer profession question → workspace configured → correct agent and skills in DB
- **Agent creation via chat**: type create prompt → tool call → agent in DB → confirm response includes actionUrl
- **Thread resume**: create thread A, start new session, ask to continue thread A by topic → thread A context returned

### What not to test at the unit level

Do not unit-test the AI's conversation choices (which tool to call when). That is model behavior, not application logic. Test the tool functions and API routes in isolation.

---

*Last updated: April 2026*
*Covers: Vaja Platform Agent, conversational onboarding, cross-channel thread continuity, LINE management bot*
*Verified against codebase: LINE multi-agent switching (lineUserAgentSession, switch_agent postback, rich menu editor) confirmed fully built — not in scope for this implementation.*
