# MCP Connector & Permission Policies — Implementation Guide

Two capabilities that bring Vaja closer to the Anthropic Managed Agents standard — without rewriting the platform.

Read `docs/ready-to-use-agents-implementation.md` first. This document extends it.

---

## Table of Contents

1. [Background: Why These Two?](#1-background-why-these-two)
2. [Part A — Permission Policies](#part-a--permission-policies)
   - [What the SDK Already Provides](#21-what-the-sdk-already-provides)
   - [Which Tools Need Approval](#22-which-tools-need-approval)
   - [Implementation Steps](#23-implementation-steps)
   - [Per-Agent Override Config](#24-per-agent-override-config)
3. [Part B — MCP Connector](#part-b--mcp-connector)
   - [Current State](#31-current-state)
   - [Architecture](#32-architecture)
   - [Schema Changes](#33-schema-changes)
   - [Implementation Steps](#34-implementation-steps)
   - [MCP Servers for Each Agent](#35-mcp-servers-for-each-agent)
4. [Implementation Checklist](#4-implementation-checklist)
5. [Common Mistakes & Gotchas](#5-common-mistakes--gotchas)

---

## 1. Background: Why These Two?

Comparing Vaja's agent system to Anthropic's Managed Agents API revealed two structural gaps:

**Permission policies**: When high-autonomy agents (Content Calendar, Sales & Promotion, Analytics Reporter) call the `distribution` tool, they broadcast to real users immediately with no confirmation gate. As agents operate at higher autonomy levels (3–5 in the Vaja model), an accidental broadcast or premature send is a real risk.

**MCP connector**: Every new external data source currently requires building a custom tool from scratch (service.ts, agent.ts, manifest, registration). MCP is a standard protocol that collapses this into "point at a URL". Thai agricultural databases, Google Workspace, LINE platform APIs, and hundreds of public MCP servers become available without custom development.

Neither requires a fundamental architecture change. The AI SDK already supports `needsApproval` natively. MCP needs a new integration layer but fits cleanly into the existing tool-building pipeline.

---

## Part A — Permission Policies

### 2.1 What the SDK Already Provides

The `ai` package (v6.0.69) already has a complete tool approval system. No new dependency needed.

**On any tool definition**, add:

```typescript
needsApproval?: boolean | (input, context) => boolean | Promise<boolean>
```

When `needsApproval` returns `true`:
1. The AI SDK emits a `tool-approval-request` part instead of executing the tool
2. The stream pauses at that step
3. The client receives the approval request, renders approval UI
4. User sends back a `tool-approval-response` part (`approved: true/false`)
5. If approved: tool executes, stream continues
6. If denied: tool is skipped, model receives denial reason

The UI component at `components/ai-elements/tool.tsx` already has `approval-requested` and `approval-responded` states defined. The labels and icons exist. The missing piece is the actual Approve/Deny button wiring.

**Data flow:**

```
streamText generates tool call
    ↓
isApprovalNeeded() checks tool.needsApproval
    ↓
true → stream emits tool-approval-request part
    ↓
Client renders ApprovalCard (needs building)
    ↓
User clicks Approve → client sends tool-approval-response { approved: true }
User clicks Deny   → client sends tool-approval-response { approved: false, reason: "..." }
    ↓
SDK resumes stream: executes tool (or skips with denial)
```

### 2.2 Which Tools Need Approval

Categorize tools by blast radius — irreversible or externally visible actions require approval.

| Tool | Default policy | Reason |
|---|---|---|
| `distribution` | `always_ask` | Broadcasts to real LINE subscribers. Irreversible. |
| `record_keeper` (delete ops) | `always_ask` | Data deletion is irreversible |
| `certificate` (bulk generate) | `always_ask` | Generates files sent to many recipients |
| `analytics` | `always_allow` | Read-only |
| `content_marketing` | `always_allow` | Generation only, no external send |
| `image` | `always_allow` | Generation only |
| `long_form` | `always_allow` | Generation only |
| `knowledge_base` | `always_allow` | Read-only |
| `weather` | `always_allow` | Read-only |
| `web_search` | `always_allow` | Read-only |
| `record_keeper` (read/write ops) | `always_allow` | Non-destructive |
| `brand_guardrails` | `always_allow` | Read/check only |
| `repurposing` | `always_allow` | Generation only |

**Decision rule**: If the tool's action creates visible output outside the chat session (sends a message, publishes content, deletes data), it needs approval. If it only generates content inside the session, it does not.

### 2.3 Implementation Steps

#### Step 1 — Add `needsApproval` to the distribution tool

The distribution tool agent adapter is at `features/distribution/agent.ts`. Add `needsApproval: true` to tools that send externally:

```typescript
// features/distribution/agent.ts
export function createDistributionAgentTools({ userId }: { userId: string }) {
  return {
    schedule_distribution: tool({
      description: '...',
      parameters: z.object({ ... }),
      needsApproval: true,   // ← add this
      execute: async (input) => distributionAction(input, userId),
    }),
    send_broadcast: tool({
      description: '...',
      parameters: z.object({ ... }),
      needsApproval: true,   // ← add this
      execute: async (input) => broadcastAction(input, userId),
    }),
    // preview/draft tools don't need approval
    preview_distribution: tool({
      description: '...',
      parameters: z.object({ ... }),
      // needsApproval not set → always_allow
      execute: async (input) => previewAction(input, userId),
    }),
  };
}
```

Same pattern for `certificate` bulk generate and `record_keeper` delete operations.

#### Step 2 — Dynamic approval based on agent autonomy level (optional)

For agents where the user has explicitly set a high autonomy level, you may want to skip approval. Use the function form:

```typescript
needsApproval: async (input, { messages, experimental_context }) => {
  // experimental_context can carry agent metadata from the chat route
  const agentAutonomyLevel = (experimental_context as any)?.autonomyLevel ?? 2;
  return agentAutonomyLevel < 4; // require approval for levels 1–3
},
```

Pass `experimental_context` in the `streamText()` call:

```typescript
// app/api/chat/route.ts
const result = streamText({
  model: modelInstance,
  system: effectiveSystemPrompt,
  messages: await convertToModelMessages(messagesForLLM),
  stopWhen: stepCountIs(useWebSearch ? 8 : maxSteps),
  experimental_context: {
    autonomyLevel: activeAgent?.structuredBehavior?.autonomyLevel ?? 2,
    userId: session.user.id,
  },
  ...(supportsTools ? { tools: activeTools } : {}),
});
```

For the initial implementation, skip the dynamic form and use `needsApproval: true` on all qualifying tools. Add per-agent override later.

#### Step 3 — Wire the Approval UI

The `components/ai-elements/tool.tsx` already has `approval-requested` state rendering a label and clock icon. It needs actual interactive buttons. Locate the `approval-requested` render block and add:

```typescript
// components/ai-elements/tool.tsx (in the approval-requested state render)
case "approval-requested":
  return (
    <div className="...">
      <ClockIcon className="size-4 text-yellow-600" />
      <span>Awaiting Approval</span>
      {/* Show what the tool is about to do */}
      <pre className="text-xs bg-muted p-2 rounded">
        {JSON.stringify(toolInvocation.input, null, 2)}
      </pre>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => addToolResult({
            toolCallId: toolInvocation.toolCallId,
            result: { approved: true },
          })}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => addToolResult({
            toolCallId: toolInvocation.toolCallId,
            result: { approved: false, reason: "Cancelled by user" },
          })}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
```

`addToolResult` is the AI SDK hook for sending tool results back into the stream. It's already imported in the chat message list component — verify the hook is accessible where tool components render.

#### Step 4 — Add `ToolPermissionPolicy` to ToolManifest

This lets the registry declare a default policy per tool. Future agents can read the manifest's policy instead of hardcoding `needsApproval` in every agent adapter.

```typescript
// features/tools/registry/types.ts
export type ToolPermissionPolicy = 'always_allow' | 'always_ask';

export type ToolManifest = {
  // ... existing fields
  defaultPermissionPolicy?: ToolPermissionPolicy; // ← add
};
```

```typescript
// features/distribution/manifest.ts
export const distributionManifest: ToolManifest = {
  id: 'distribution',
  // ...
  defaultPermissionPolicy: 'always_ask',  // ← add
};
```

In `buildToolSet()`, read the manifest's policy when building registry tools and apply `needsApproval` automatically:

```typescript
// lib/tools/index.ts (in buildRegistryAgentTools or buildToolSet)
// After building tools from registry, patch needsApproval from manifest
for (const [toolName, toolDef] of Object.entries(registryTools)) {
  const manifest = getManifestForToolName(toolName); // needs a lookup helper
  if (manifest?.defaultPermissionPolicy === 'always_ask') {
    (toolDef as any).needsApproval = true;
  }
}
```

### 2.4 Per-Agent Override Config

Some agents should have stricter or looser policies than the defaults. The `structuredBehavior` JSONB field on the `agent` table can store this without a schema migration.

```typescript
// lib/agent-structured-behavior.ts (extend existing type)
export type AgentStructuredBehavior = {
  // existing fields...
  toolPermissions?: {
    [toolName: string]: 'always_allow' | 'always_ask';
  };
  autonomyLevel?: 1 | 2 | 3 | 4 | 5;
};
```

In `buildToolSet()`, after applying manifest defaults, apply per-agent overrides:

```typescript
if (activeAgent?.structuredBehavior?.toolPermissions) {
  for (const [toolName, policy] of Object.entries(
    activeAgent.structuredBehavior.toolPermissions
  )) {
    if (result[toolName]) {
      (result[toolName] as any).needsApproval = policy === 'always_ask';
    }
  }
}
```

**Default autonomy levels per ready-to-use agent:**

| Agent | Default autonomy level | Distribution policy |
|---|---|---|
| General Assistant | 1 | N/A — no distribution tool |
| LINE OA Customer Service | 3 | always_ask |
| Content Creator | 2 | always_ask |
| Farm Consultant | 1 | N/A |
| Teacher's Aide | 1 | N/A |
| Healthcare Communicator | 1 | N/A |
| Government Officer Aide | 1 | N/A |
| Content Calendar Agent | 4 | always_ask |
| Analytics Reporter | 4 | always_ask |
| Sales & Promotion Agent | 3 | always_ask |

Note: All agents with the `distribution` tool default to `always_ask` regardless of autonomy level. The autonomy level influences how much the agent proactively suggests actions, not whether it bypasses approval gates.

---

## Part B — MCP Connector

### 3.1 Current State

The `ai` SDK v6.0.69 does **not** include MCP support in its exports. The `@modelcontextprotocol/sdk` package is not installed. All external data integrations currently require custom tools.

MCP support needs to be added via the official `@modelcontextprotocol/sdk` and a bridge layer that converts MCP server tools into AI SDK tools.

### 3.2 Architecture

```
Agent record stores mcp_servers: [{ name, url, description }]
        ↓
app/api/chat/route.ts reads activeAgent.mcpServers
        ↓
lib/tools/mcp.ts: createMCPToolSet(mcpServers, credentials)
        ├── For each server: connect via @modelcontextprotocol/sdk
        ├── Fetch available tools from server
        └── Convert to AI SDK tool() definitions
        ↓
Merged into groundedTools alongside existing tool set
        ↓
streamText receives MCP tools alongside native tools
```

MCP tools execute **server-side** (the MCP server executes them). The AI emits a tool call, your code sends it to the MCP server, the server runs it, returns the result.

### 3.3 Schema Changes

Add `mcpServers` to the `agent` table. No new table needed — store as JSONB.

```typescript
// db/schema/agents.ts — add to pgTable definition
mcpServers: jsonb("mcp_servers")
  .$type<McpServerConfig[]>()
  .notNull()
  .default(sql`'[]'::jsonb`),
```

```typescript
// New type — add to lib/types/mcp.ts or features/agents/types.ts
export type McpServerConfig = {
  name: string;           // unique within the agent, used as tool name prefix
  url: string;            // MCP server HTTP endpoint
  description?: string;  // shown in agent editor UI
  authType?: 'none' | 'bearer' | 'api_key';  // credential type
  credentialKey?: string; // references a key in user's stored credentials
};
```

After adding the field:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Also extend the `Agent` TypeScript type in `features/agents/types.ts`:
```typescript
export type Agent = {
  // ... existing fields
  mcpServers: McpServerConfig[];
};
```

### 3.4 Implementation Steps

#### Step 1 — Install the MCP SDK

```bash
pnpm add @modelcontextprotocol/sdk
```

#### Step 2 — Create `lib/tools/mcp.ts`

```typescript
// lib/tools/mcp.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { tool } from 'ai';
import { z } from 'zod';
import type { McpServerConfig } from '@/features/agents/types';

/**
 * Connect to one MCP server and return its tools as AI SDK tool definitions.
 *
 * Tool names are prefixed with the server name to avoid collisions:
 *   server "github" + tool "create_issue" → "github__create_issue"
 */
async function buildToolsForServer(
  server: McpServerConfig,
  credentials?: Record<string, string>,
): Promise<Record<string, ReturnType<typeof tool>>> {
  const headers: Record<string, string> = {};
  if (server.authType === 'bearer' && server.credentialKey) {
    const token = credentials?.[server.credentialKey];
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (server.authType === 'api_key' && server.credentialKey) {
    const key = credentials?.[server.credentialKey];
    if (key) headers['X-API-Key'] = key;
  }

  const client = new Client(
    { name: 'vaja-mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );

  const transport = new StreamableHTTPClientTransport(
    new URL(server.url),
    { requestInit: { headers } },
  );

  await client.connect(transport);
  const { tools: mcpTools } = await client.listTools();

  const aiSdkTools: Record<string, ReturnType<typeof tool>> = {};

  for (const mcpTool of mcpTools) {
    const toolId = `${server.name}__${mcpTool.name}`;

    // Convert MCP JSON Schema to Zod (simple pass-through via z.object + z.any)
    // For production: use a JSON Schema → Zod library like json-schema-to-zod
    const paramSchema = mcpTool.inputSchema?.properties
      ? z.object(
          Object.fromEntries(
            Object.keys(mcpTool.inputSchema.properties).map((k) => [k, z.any()]),
          ),
        )
      : z.object({});

    aiSdkTools[toolId] = tool({
      description: `[${server.name}] ${mcpTool.description ?? mcpTool.name}`,
      parameters: paramSchema,
      execute: async (input) => {
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: input as Record<string, unknown>,
        });
        // MCP returns content array — flatten to text for the AI
        return result.content
          .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
          .join('\n');
      },
    });
  }

  await client.close();
  return aiSdkTools;
}

/**
 * Build a combined tool set from all MCP servers configured on an agent.
 * Returns an empty object if mcpServers is empty or on connection failure.
 */
export async function buildMCPToolSet(
  mcpServers: McpServerConfig[],
  credentials?: Record<string, string>,
): Promise<Record<string, ReturnType<typeof tool>>> {
  if (!mcpServers || mcpServers.length === 0) return {};

  const results = await Promise.allSettled(
    mcpServers.map((server) => buildToolsForServer(server, credentials)),
  );

  const merged: Record<string, ReturnType<typeof tool>> = {};
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value);
    } else {
      console.error(`MCP server "${mcpServers[i]!.name}" failed to connect:`, result.reason);
      // Fail silently — degrade gracefully, don't break the chat request
    }
  }

  return merged;
}
```

#### Step 3 — Integrate into `app/api/chat/route.ts`

In the tool-building section (around line 208 where `groundedTools` is built), add MCP tool loading in parallel:

```typescript
// After building groundedTools, fetch MCP tools if agent has them
const mcpTools = activeAgent?.mcpServers?.length
  ? await buildMCPToolSet(
      activeAgent.mcpServers,
      getUserMcpCredentials(session.user.id), // see Step 4
    ).catch((err) => {
      console.error('MCP tool build failed:', err);
      return {};
    })
  : {};

const groundedToolsWithMCP = { ...groundedTools, ...mcpTools };
// Replace groundedTools with groundedToolsWithMCP throughout the rest of the function
```

Move this before the `streamText()` call. The `await` is acceptable here — MCP tool listing is fast (single HTTP request per server).

#### Step 4 — Credential storage (simple first pass)

For the initial implementation, store MCP credentials as user preferences (environment-style key-value pairs). Add a `mcpCredentials` field to `userPreferences`:

```typescript
// db/schema/users.ts — extend userPreferences
mcpCredentials: jsonb("mcp_credentials")
  .$type<Record<string, string>>()
  .default(sql`'{}'::jsonb`),
```

```typescript
// lib/tools/mcp.ts
function getUserMcpCredentials(userId: string): Promise<Record<string, string>> {
  // fetch from userPreferences.mcpCredentials
}
```

This is intentionally simple. A proper vault system (encrypted credentials, rotation, org-level secrets) is a Phase 2 concern. For the initial use cases (DOAE market prices, public APIs with read-only keys), the simple approach is sufficient.

#### Step 5 — Agent editor UI

Add an MCP servers section to the agent editor at `features/agents/components/`. This is a list of `{ name, url, description, authType, credentialKey }` entries. Each server shows:
- Name (text input, used as tool prefix)
- URL (text input)
- Description (optional)
- Auth type (select: none / bearer / api_key)
- Credential key (text input — the key name from `mcpCredentials`)

Keep it minimal for Phase 1. The admin can seed `mcpServers` on templates directly via the seed script — UI is for user customization.

#### Step 6 — MCP permission policies

MCP tools default to `always_ask` in the Anthropic spec (because unknown tools from external servers should not auto-execute). Apply the same default in Vaja:

```typescript
// In buildMCPToolSet, after creating each tool
aiSdkTools[toolId] = tool({
  ...
  needsApproval: true,  // MCP tools always require approval by default
  execute: async (input) => { ... },
});
```

Per-agent override: if the user has explicitly trusted a server, they can set `needsApproval: false` in their agent config. This is a Phase 2 UI feature — for Phase 1, all MCP tools require approval.

### 3.5 MCP Servers for Each Agent

The following MCP servers are prioritized for the ready-to-use agents. These become defaults in the agent seed records once MCP is implemented.

#### Farm Consultant — highest priority

| Server name | URL | Purpose | Auth |
|---|---|---|---|
| `doae` | `https://mcp.doae.go.th/api` (future) | Live Thai agricultural market prices, pest alerts from กรมส่งเสริมการเกษตร | API key |
| `openweather` | `https://mcp.openweathermap.org/` (community) | Detailed farm weather: humidity, rainfall, soil temp forecasts | API key |

Until an official DOAE MCP server exists, the Farm Consultant uses the Tavily `web_search` tool to fetch prices. When the DOAE MCP server is available, it becomes the preferred source.

#### Government Officer Aide

| Server name | URL | Purpose | Auth |
|---|---|---|---|
| `thai-law` | TBD — depends on Thai government digitization | ค้นหากฎหมาย พ.ร.บ. ระเบียบราชการ | None (public) |
| `google-docs` | `https://mcp.googleapis.com/docs` (community) | Create and update Google Docs from drafts | OAuth via vault |

#### Content Calendar Agent

| Server name | URL | Purpose | Auth |
|---|---|---|---|
| `google-calendar` | `https://mcp.googleapis.com/calendar` (community) | Read/write content calendar events | OAuth via vault |
| `google-sheets` | `https://mcp.googleapis.com/sheets` (community) | Read brand guidelines and content plans from sheets | OAuth via vault |

#### Analytics Reporter

| Server name | URL | Purpose | Auth |
|---|---|---|---|
| `line-official-account` | `https://api.line.me/mcp` (if LINE supports MCP) | Direct LINE OA metrics instead of going through Vaja's analytics table | LINE API key |

#### General Assistant

| Server name | URL | Purpose | Auth |
|---|---|---|---|
| `everything` | `https://github.com/modelcontextprotocol/servers/tree/main/src/everything` | Reference MCP server for testing capabilities | None |

**Practical reality**: Most of these MCP servers don't exist yet as publicly hosted endpoints. The pattern to follow is:
1. Check `github.com/modelcontextprotocol/servers` for community servers
2. For Thai government data, the only practical path is `web_search` until official APIs are published
3. Google Workspace MCP servers are available from Google — these are real and usable now

---

## 4. Implementation Checklist

### Phase A — Permission Policies (1–2 weeks)

**Week 1: SDK wiring**
- [ ] Add `needsApproval: true` to `distribution` tool's send/broadcast operations in `features/distribution/agent.ts`
- [ ] Add `needsApproval: true` to `certificate` bulk generate in `features/certificate/agent.ts`
- [ ] Add `needsApproval: true` to `record_keeper` delete operations in `features/record-keeper/agent.ts`
- [ ] Add `defaultPermissionPolicy` field to `ToolManifest` type in `features/tools/registry/types.ts`
- [ ] Set `defaultPermissionPolicy: 'always_ask'` on `distributionManifest`
- [ ] Pass `experimental_context: { autonomyLevel, userId }` in `streamText()` call in `app/api/chat/route.ts`

**Week 2: UI**
- [ ] Wire Approve/Deny buttons in `components/ai-elements/tool.tsx` for `approval-requested` state
- [ ] Test: Content Calendar Agent + "schedule all posts" → distribution tool triggers approval card
- [ ] Test: User denies → AI acknowledges and stops
- [ ] Test: User approves → distribution executes

**Optional enhancement**
- [ ] Add `toolPermissions` and `autonomyLevel` to `AgentStructuredBehavior` type
- [ ] Apply per-agent permission overrides in `buildToolSet()`
- [ ] Update seed script: set `autonomyLevel` on Content Calendar (4), Analytics Reporter (4), others (1–3)

### Phase B — MCP Connector (2–4 weeks)

**Week 1: Foundation**
- [ ] `pnpm add @modelcontextprotocol/sdk`
- [ ] Add `mcpServers` JSONB field to `agent` table in `db/schema/agents.ts`
- [ ] Add `mcpCredentials` JSONB field to `userPreferences` in `db/schema/users.ts`
- [ ] Run `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
- [ ] Extend `Agent` type in `features/agents/types.ts`
- [ ] Create `lib/tools/mcp.ts` with `buildMCPToolSet()`

**Week 2: Integration**
- [ ] Integrate `buildMCPToolSet()` into `app/api/chat/route.ts`
- [ ] All MCP tools default `needsApproval: true`
- [ ] Test with a public MCP server (e.g., the reference `everything` server)
- [ ] Confirm graceful degradation when MCP server is unreachable

**Week 3: UI + Agent Editor**
- [ ] Add MCP servers list editor to agent editor UI (`features/agents/components/`)
- [ ] Add MCP credentials manager to user settings (`features/settings/`)
- [ ] Update admin agent create/update API to accept `mcpServers` field
- [ ] Update seed script to include `mcpServers: []` on all templates

**Week 4: Google Workspace (optional but high value)**
- [ ] Set up Google Workspace MCP server connection
- [ ] Integrate with Content Calendar Agent (`google-calendar`)
- [ ] Test end-to-end: agent reads Google Calendar → schedules content aligned to events

---

## 5. Common Mistakes & Gotchas

### MCP tool names must not conflict with existing tool IDs

Prefix all MCP tool names with `{serverName}__` (double underscore). This ensures `github__create_issue` never collides with a hypothetical future `create_issue` tool in the registry.

### `client.close()` is mandatory

The MCP client holds an open HTTP connection. Always call `client.close()` after listing tools. If using long-lived connections in the future (for streaming tool execution), manage lifecycle carefully.

### MCP servers that list 50+ tools

Some MCP servers expose dozens of tools. Every tool is included in the model's system prompt context (tool definitions consume tokens). Limit to relevant tools by filtering `mcpTools` by name prefix or category before building AI SDK tools. Add a `toolFilter?: string[]` to `McpServerConfig` for this.

### `needsApproval` on streaming vs. non-streaming

`needsApproval` works in `streamText`. It does NOT work in `generateText` (non-streaming). Vaja's chat route uses `streamText` — this is fine. If you ever add a non-streaming code path, tool approval must be handled differently.

### Approval UI requires `addToolResult` access

The Approve/Deny buttons need to call `addToolResult` from the `useChat` hook. This hook is available in client components only — confirm the tool rendering component has access to it via context or props. Do not try to call it from a server component.

### JSON Schema → Zod conversion is lossy

The simple `z.any()` approach for MCP tool parameters loses type validation. For Phase 1 this is acceptable — the AI still sees the original JSON Schema description and knows what to pass. For Phase 2, use `json-schema-to-zod` (`pnpm add json-schema-to-zod`) to generate proper Zod schemas from MCP tool input schemas.

### MCP credentials are stored unencrypted in Phase 1

The `mcpCredentials` JSONB field in `userPreferences` is plaintext. This is acceptable for read-only API keys to public datasets. For OAuth tokens or write-access credentials, implement proper encryption before storing (use a KMS or at minimum AES-256 with a server-side key). Do not store sensitive credentials in Phase 1 — gate the credentials UI with a warning.
