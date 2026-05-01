# User-Created Tools - Technical Follow-Up

This document turns the product proposal in `docs/user-created-tools-implementation.md` into an engineering-ready plan with:

- concrete schema drafts
- runtime integration points
- API and UI surface proposals
- file-by-file implementation steps

This is intentionally biased toward **phase 1 implementation**:

- owner-created tools
- declarative definitions
- webhook execution types
- agent attachment support
- manual test UI
- persistent run history

It does **not** assume arbitrary code execution.

Read this after:

- `docs/user-created-tools-implementation.md`
- `IMPLEMENTATION.md`
- `implementation_future.md`
- `docs/mcp-and-permission-policies-implementation.md`

---

## Progress Update

Last updated: 2026-04-28

Implemented:

- `db/schema/user-tools.ts`
- `db/schema.ts` export update
- `features/user-tools/types.ts`
- `features/user-tools/schema.ts`
- `features/user-tools/service.ts`
- `features/user-tools/server/queries.ts`
- `features/user-tools/server/mutations.ts`
- `features/user-tools/server/permissions.ts`
- `features/user-tools/server/runtime.ts`
- `features/user-tools/server/history.ts`
- `features/user-tools/server/executors/webhook.ts`
- `features/user-tools/server/executors/workflow.ts`
- `app/api/user-tools/route.ts`
- `app/api/user-tools/[toolId]/route.ts`
- `app/api/user-tools/[toolId]/versions/route.ts`
- `app/api/user-tools/[toolId]/test/route.ts`
- `app/api/user-tools/[toolId]/run/route.ts`
- `app/api/user-tools/[toolId]/runs/route.ts`
- `app/api/user-tools/[toolId]/publish/route.ts`
- `app/api/user-tools/[toolId]/share/route.ts`
- `app/api/agents/[id]/user-tools/route.ts`
- `app/(main)/user-tools/page.tsx`
- `features/user-tools/components/*` initial builder/test/history UI
- `features/user-tools/hooks/*`
- agent runtime merge in `features/agents/server/run-service.ts`
- initial agent editor custom-tool attachment UI
- initial per-user custom-tool sharing UI
- tool metadata update and version-save flow from the `/user-tools` page
- draft-reset fix on the `/user-tools` page so "New draft" preserves an unsaved editor state and no longer falls back to the first saved tool
- editor-scroll fix on the `/user-tools` page so draft reset and tool selection return the builder panel to the top
- layout fix on the `/user-tools` page so the builder uses normal page flow instead of nested scroll containers that could hide the editor
- responsive workbench fix on the `/user-tools` page so the library sits beside a stacked editor/test area instead of forcing library, editor, and runner into three cramped columns
- manual confirmation enforcement for write or confirmation-required custom tools
- webhook hardening for HTTPS-only URLs, local/private destination blocking, redirect rejection, response-size limits, timeout caps, and restricted custom headers
- server-side validation for agent custom-tool attachments so only accessible, agent-enabled, non-archived tools can be attached
- regression tests for attachment deduping and attachment validation
- declarative workflow execution for multi-step custom tools that create campaign briefs, calendar entries, and social post drafts through service-layer integrations
- builder support for both `webhook` and `workflow` execution types
- workflow artifact persistence through `toolArtifact` plus artifact links in the unified tool result envelope
- `scripts/reconcile-drizzle-ledger.ts` to backfill already-live migrations and apply the missing `0035_numerous_lockheed` data migration in drifted environments
- owner-managed share route and UI for per-user `runner` / `editor` access to custom tools
- brand-backed workspace share table, routes, queries, hooks, and UI for sharing one tool with all members of a selected workspace
- workspace-share-aware access resolution in tool discovery, tool detail, agent attachment validation, and agent runtime execution

Not implemented yet:

- skill unlock support for custom tools
- richer `toolRun` attribution columns such as `toolKind`, `toolId`, `toolVersionId`, and `agentId`
- connected-account or secret-ref auth resolution inside custom webhook execution
- LINE-specific custom-tool runtime integration
- template publishing and broader catalog/publish semantics

Notes:

- The current UI uses JSON textareas for input schema, output schema, webhook request templates, and workflow step definitions instead of the future field-builder UX described below.
- The current runtime now supports both `webhook` and `workflow` custom tools, with workflow limited to the currently implemented declarative Vaja step types.
- The current builder can create tools, edit metadata, save a new draft version, publish a version, test runs, and inspect run history.
- `pnpm exec tsc --noEmit` and `pnpm test` pass with the current implementation slice.
- Phases 1 through 3 are now code-complete for the current scope: owner-created webhook tools, workspace tools via direct user shares plus brand-backed workspace shares, and workflow tools that compose existing Vaja services.

---

## 1. Key Technical Decisions

### 1.1 Keep built-in tools and user-created tools separate in storage

Do **not** put user-created tool IDs into:

- `userPreferences.enabledToolIds`
- `agent.enabledTools`

Why:

- those fields currently model **built-in registry tool IDs**
- user-created tools are user-owned records with versioning and permission checks
- mixing both into the same array makes validation, sharing, and history harder

Instead:

- keep existing built-in tool fields unchanged
- add dedicated tables for user-created tool ownership and agent attachments
- merge both at runtime into one final `ToolSet`

### 1.2 Reuse `toolRun` and `toolArtifact`

The repo already has:

- `toolRun`
- `toolArtifact`

User-created tools should reuse this execution history layer instead of introducing a second run-history system.

Recommended schema extension:

- add source/type metadata so `toolRun` can distinguish built-in and custom tools cleanly

### 1.3 Phase 1 scope

Phase 1 should support:

- manual execution from a tool page
- agent execution when explicitly attached to an agent
- owner and explicit share access
- `webhook` and `workflow` execution types
- approval gating for write actions

Phase 1 should **not** support:

- public marketplace publishing
- skill-unlock of custom tools
- arbitrary code uploads
- arbitrary external secret text blobs

Custom-tool unlock via skills should be a **phase 2** extension after permission rules are proven.

---

## 2. Schema Drafts

## 2.1 New file: `db/schema/user-tools.ts`

Suggested first-pass schema:

```ts
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agent } from "./agents";
import { connectedAccount } from "./integrations";

export const userTool = pgTable("user_tool", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("Wrench"),
  category: text("category").notNull().default("utilities"),
  executionType: text("execution_type").notNull(), // 'webhook' | 'workflow'
  visibility: text("visibility").notNull().default("private"), // 'private' | 'shared' | 'template' | 'published'
  status: text("status").notNull().default("draft"), // 'draft' | 'active' | 'archived'
  readOnly: boolean("read_only").notNull().default(true),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  supportsAgent: boolean("supports_agent").notNull().default(true),
  supportsManualRun: boolean("supports_manual_run").notNull().default(true),
  latestVersion: integer("latest_version").notNull().default(1),
  activeVersion: integer("active_version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("user_tool_userId_idx").on(table.userId),
  uniqueIndex("user_tool_owner_slug_idx").on(table.userId, table.slug),
  index("user_tool_status_idx").on(table.status),
]);

export const userToolVersion = pgTable("user_tool_version", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  inputSchemaJson: jsonb("input_schema_json").notNull(),
  outputSchemaJson: jsonb("output_schema_json").notNull(),
  configJson: jsonb("config_json").notNull(),
  changeSummary: text("change_summary"),
  isDraft: boolean("is_draft").notNull().default(true),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tool_version_unique_idx").on(table.toolId, table.version),
  index("user_tool_version_toolId_idx").on(table.toolId),
]);

export const userToolShare = pgTable("user_tool_share", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  sharedWithUserId: text("shared_with_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("runner"), // 'runner' | 'editor'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tool_share_unique_idx").on(table.toolId, table.sharedWithUserId),
  index("user_tool_share_toolId_idx").on(table.toolId),
  index("user_tool_share_userId_idx").on(table.sharedWithUserId),
]);

export const agentUserToolAttachment = pgTable("agent_user_tool_attachment", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  userToolId: text("user_tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("agent_user_tool_attachment_unique_idx").on(table.agentId, table.userToolId),
  index("agent_user_tool_attachment_agentId_idx").on(table.agentId),
  index("agent_user_tool_attachment_userToolId_idx").on(table.userToolId),
]);

export const userToolConnection = pgTable("user_tool_connection", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // 'google', 'crm', 'line', 'custom-api'
  connectionType: text("connection_type").notNull(), // 'connected_account' | 'secret_ref'
  connectedAccountId: text("connected_account_id").references(() => connectedAccount.id, { onDelete: "set null" }),
  secretRef: text("secret_ref"),
  configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("user_tool_connection_tool_key_idx").on(table.toolId, table.key),
  index("user_tool_connection_toolId_idx").on(table.toolId),
]);

export const userToolRelations = relations(userTool, ({ one, many }) => ({
  owner: one(user, { fields: [userTool.userId], references: [user.id] }),
  versions: many(userToolVersion),
  shares: many(userToolShare),
  attachments: many(agentUserToolAttachment),
  connections: many(userToolConnection),
}));
```

### Why these tables

- `userTool` is the stable identity and sharing record
- `userToolVersion` stores schema/config snapshots safely
- `userToolShare` mirrors the existing agent-share pattern
- `agentUserToolAttachment` avoids overloading `agent.enabledTools`
- `userToolConnection` reuses `connected_account` where possible

---

## 2.2 Extend `db/schema/tools.ts`

Current `toolRun` is close, but user-created tools need better attribution.

Suggested delta:

```ts
export const toolRun = pgTable("tool_run", {
  id: text("id").primaryKey(),
  toolSlug: text("tool_slug").notNull(),
  toolKind: text("tool_kind").notNull().default("built_in"), // 'built_in' | 'user_created'
  toolId: text("tool_id"),
  toolVersionId: text("tool_version_id"),
  agentId: text("agent_id"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
  source: text("source").notNull(), // 'sidebar' | 'agent' | 'api' | 'test'
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

### Why this matters

- `toolKind` separates built-in vs custom analytics
- `toolId` and `toolVersionId` preserve traceability after edits
- `agentId` supports audit for agent-triggered side effects
- `source: 'test'` gives the builder UI a safe test channel

---

## 2.3 Update `db/schema.ts`

Add:

```ts
export * from "./schema/user-tools";
```

---

## 2.4 Type drafts for `features/user-tools/types.ts`

Suggested runtime types:

```ts
export type UserToolExecutionType = "webhook" | "workflow";
export type UserToolVisibility = "private" | "shared" | "template" | "published";
export type UserToolStatus = "draft" | "active" | "archived";
export type UserToolShareRole = "runner" | "editor";
export type UserToolSource = "sidebar" | "agent" | "api" | "test";

export type UserToolFieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "enum"
  | "date"
  | "json";

export type UserToolField = {
  key: string;
  label: string;
  type: UserToolFieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: unknown;
};

export type UserToolWebhookConfig = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  connectionKey?: string;
  timeoutMs?: number;
  headersTemplate?: Record<string, string>;
  requestBodyMode: "json";
  requestTemplate?: Record<string, unknown>;
  responseDataPath?: string;
};

export type UserToolWorkflowStep =
  | { kind: "prompt_template"; template: string }
  | { kind: "call_builtin_tool"; toolId: string; inputTemplate: Record<string, unknown> }
  | { kind: "persist_artifact"; artifactType: "json" | "link" };

export type UserToolWorkflowConfig = {
  steps: UserToolWorkflowStep[];
};

export type UserToolExecutionConfig =
  | { type: "webhook"; webhook: UserToolWebhookConfig }
  | { type: "workflow"; workflow: UserToolWorkflowConfig };
```

### Important constraint

Do not store executable JavaScript in config JSON.

Use:

- field definitions
- templates
- structured step configs

Do not use:

- script strings
- eval-like execution

---

## 3. Runtime Design

## 3.1 New feature boundary

Add:

```text
features/user-tools/
  types.ts
  schema.ts
  service.ts
  server/
    queries.ts
    mutations.ts
    permissions.ts
    runtime.ts
    history.ts
    executors/
      webhook.ts
      workflow.ts
  hooks/
    use-user-tools.ts
    use-user-tool-runs.ts
  components/
    user-tools-page.tsx
    tool-builder.tsx
    tool-runner.tsx
    tool-run-history.tsx
    sections/
      general-section.tsx
      inputs-section.tsx
      action-section.tsx
      access-section.tsx
      test-section.tsx
```

### Why `service.ts` still matters

Even though these tools are user-defined, the canonical business logic should still pass through a real service layer:

- builder mutations
- runtime execution
- permission checks
- run persistence

This keeps the same architectural rule as built-in tools: business logic belongs in service/server code, not UI code.

---

## 3.2 Dynamic runtime builder

Add a server runtime function:

```ts
export async function buildUserCreatedToolSet(params: {
  userId: string;
  agentId?: string | null;
  source: "manual" | "agent";
}): Promise<Record<string, unknown>>
```

Responsibilities:

1. load eligible custom tools for the current user and agent
2. resolve active version
3. enforce visibility and share rules
4. convert each tool definition into an AI SDK `tool(...)`
5. apply `needsApproval` for write tools or tools requiring confirmation

### Chat integration point

In `app/api/chat/route.ts`, after built-in tool assembly:

```ts
const builtInTools = supportsTools ? groundedTools : undefined;
const customTools = supportsTools
  ? await buildUserCreatedToolSet({
      userId: session.user.id,
      agentId: activeAgent?.id ?? null,
      source: "agent",
    })
  : {};

const activeTools = supportsTools
  ? { ...builtInTools, ...customTools }
  : undefined;
```

This keeps built-in and custom tools independent but composable.

---

## 3.3 Permission gate

Add `features/user-tools/server/permissions.ts`.

Core functions:

```ts
canViewUserTool(userId, tool)
canEditUserTool(userId, tool)
canRunUserTool(userId, tool, { agentId, source })
needsApprovalForUserTool(tool, source)
```

Rules for phase 1:

- owner can always edit and run
- shared `editor` can edit and run
- shared `runner` can run only
- agent execution allowed only when attached to that agent
- archived tools cannot run
- inactive draft versions cannot run in agent mode

### Approval integration

For runtime-generated AI SDK tools:

```ts
needsApproval: tool.readOnly ? false : tool.requiresConfirmation
```

This aligns with the approval model in `docs/mcp-and-permission-policies-implementation.md`.

---

## 3.4 Executors

### `executors/webhook.ts`

Responsibilities:

- resolve connection/auth context
- build request payload from structured templates
- validate allowed destination pattern
- execute fetch with timeout
- normalize response into `ToolExecutionResult`

### `executors/workflow.ts`

Responsibilities:

- resolve each declarative step
- call built-in tool services, not route handlers
- collect step outputs
- persist artifacts if configured
- normalize final result

### Important rule

Workflow tools should call **service-layer functions** or shared domain functions, not local HTTP endpoints.

Do not build a workflow engine that internally calls `/api/...`.

---

## 4. API Surface

Add dedicated CRUD and test routes for builder UX.

### Suggested routes

```text
app/api/user-tools/route.ts
app/api/user-tools/[toolId]/route.ts
app/api/user-tools/[toolId]/versions/route.ts
app/api/user-tools/[toolId]/test/route.ts
app/api/user-tools/[toolId]/runs/route.ts
app/api/user-tools/[toolId]/publish/route.ts
app/api/user-tools/[toolId]/attachments/route.ts
```

### Route responsibilities

- `GET /api/user-tools` - list owned + shared tools
- `POST /api/user-tools` - create new tool
- `GET /api/user-tools/[toolId]` - detail with active version
- `PATCH /api/user-tools/[toolId]` - update metadata
- `POST /api/user-tools/[toolId]/versions` - save a new version snapshot
- `POST /api/user-tools/[toolId]/test` - run test execution with `source: 'test'`
- `GET /api/user-tools/[toolId]/runs` - history view
- `POST /api/user-tools/[toolId]/publish` - activate draft version
- `PUT /api/user-tools/[toolId]/attachments` - assign to agents

### Manual run endpoint

For actual runtime execution outside test mode, prefer:

```text
POST /api/user-tools/[toolId]/run
```

This keeps custom tools separate from built-in `/api/tools/...` routes.

---

## 5. UI Surface

## 5.1 New control-room page

Suggested route:

```text
app/(main)/user-tools/page.tsx
```

Why:

- custom tool management is a builder/workspace concern
- built-in tool pages under `/tools/[toolSlug]` should stay focused on running specific tool experiences

### Suggested builder UI

- left panel: tool list
- center: editor tabs
- right panel: test runner / run result

Suggested editor tabs:

- General
- Inputs
- Action
- Access
- Test
- History

## 5.2 Agent form integration

Add a custom-tool section to the agent builder.

Suggested files:

- `features/agents/components/agent-custom-tools-section.tsx`
- extend existing agent form fetch/save flow

This section should manage `agentUserToolAttachment`, not `agent.enabledTools`.

---

## 6. File-by-File Implementation Steps

This is the recommended first implementation sequence.

### Step 1 - Add schema

Create:

- `db/schema/user-tools.ts`

Update:

- `db/schema.ts`
- migration via `pnpm drizzle-kit generate`

Optional delta:

- extend `db/schema/tools.ts` for richer `toolRun` attribution

Status:

- code completed
- migration generated
- migration applied on 2026-04-28 after reconciling missing Drizzle ledger entries with `pnpm db:reconcile-migrations`
- `toolRun` extension not started yet

### Step 2 - Add shared types and Zod schemas

Create:

- `features/user-tools/types.ts`
- `features/user-tools/schema.ts`

`schema.ts` should validate:

- create/update tool payloads
- version payloads
- test run input
- list query params

### Step 3 - Add server query layer

Create:

- `features/user-tools/server/queries.ts`

Core functions:

- `getUserToolsForUser(userId)`
- `getUserToolById(toolId, userId)`
- `getRunnableUserToolsForAgent(agentId, userId)`
- `getUserToolRuns(toolId, userId)`

### Step 4 - Add server mutation layer

Create:

- `features/user-tools/server/mutations.ts`

Core functions:

- `createUserTool(input, userId)`
- `updateUserTool(toolId, input, userId)`
- `createUserToolVersion(toolId, input, userId)`
- `publishUserToolVersion(toolId, version, userId)`
- `replaceAgentUserToolAttachments(agentId, attachments, userId)`

### Step 5 - Add permission helpers

Create:

- `features/user-tools/server/permissions.ts`

This file should be imported by both:

- route handlers
- runtime execution paths

### Step 6 - Add runtime execution

Create:

- `features/user-tools/server/runtime.ts`
- `features/user-tools/server/executors/webhook.ts`
- `features/user-tools/server/executors/workflow.ts`
- `features/user-tools/server/history.ts`

Core functions:

- `buildUserCreatedToolSet(...)`
- `executeUserToolVersion(...)`
- `recordUserToolRunStart(...)`
- `recordUserToolRunSuccess(...)`
- `recordUserToolRunError(...)`

### Step 7 - Add API routes

Create:

- `app/api/user-tools/route.ts`
- `app/api/user-tools/[toolId]/route.ts`
- `app/api/user-tools/[toolId]/versions/route.ts`
- `app/api/user-tools/[toolId]/test/route.ts`
- `app/api/user-tools/[toolId]/run/route.ts`
- `app/api/user-tools/[toolId]/runs/route.ts`
- `app/api/user-tools/[toolId]/publish/route.ts`
- `app/api/agents/[id]/user-tools/route.ts`

Status:

- completed

### Step 8 - Add hooks

Create:

- `features/user-tools/hooks/use-user-tools.ts`
- `features/user-tools/hooks/use-user-tool-runs.ts`
- `features/user-tools/hooks/use-user-tool-test.ts`

These should follow the same React Query mutation/query pattern used elsewhere in the repo.

Status:

- completed

### Step 9 - Add builder UI

Create:

- `features/user-tools/components/user-tools-page.tsx`
- `features/user-tools/components/tool-builder.tsx`
- `features/user-tools/components/tool-runner.tsx`
- `features/user-tools/components/tool-run-history.tsx`

Route:

- `app/(main)/user-tools/page.tsx`

Sidebar item:

- extend `features/chat/components/sidebar/sidebar-nav.tsx`

Status:

- completed using the workspace registry system in `features/workspace/catalog.ts`
- current builder is a thin JSON-based UI, not the full visual field builder yet
- create, edit, save-version, publish, test, and run flows are implemented
- the builder now shows an explicit draft-editor state and no longer auto-reselects the first saved tool after "New draft"

### Step 10 - Integrate with agents

Create:

- `features/agents/components/agent-custom-tools-section.tsx`

Update:

- agent load/save API payloads and queries
- agent editor UI to show built-in tools and custom tools separately

Status:

- runtime integration completed
- agent editor attachment UI implemented in a first pass
- still needs UX refinement and end-to-end testing

### Step 11 - Integrate with chat runtime

Update:

- `app/api/chat/route.ts`
- possibly `features/line-oa/webhook/...` later

Manual chat integration order:

1. built-in tools
2. custom tools attached to agent
3. merge into final `activeTools`

Status:

- completed in `features/agents/server/run-service.ts`
- `app/api/chat/route.ts` consumes this through the existing `prepareAgentRun(...)` path

### Step 12 - Extend workspace AI assistant support

Update:

- `features/workspace-ai/schema.ts`

Add `tool` to:

- `workspaceAssistEntityTypeSchema`

Then add assist kinds such as:

- `tool-description`
- `tool-input-help`
- `tool-test-data`

This gives the builder AI help parity with agents and skills.

---

## 7. Example Request/Response Shapes

## 7.1 Create tool request

```json
{
  "name": "Lead Qualification",
  "slug": "lead-qualification",
  "description": "Score a lead and prepare a next-step summary.",
  "icon": "BadgeHelp",
  "category": "utilities",
  "executionType": "webhook",
  "readOnly": true,
  "requiresConfirmation": false,
  "supportsAgent": true,
  "supportsManualRun": true
}
```

## 7.2 Create version request

```json
{
  "version": 1,
  "inputSchema": [
    { "key": "leadName", "label": "Lead name", "type": "text", "required": true },
    { "key": "notes", "label": "Notes", "type": "long_text" }
  ],
  "outputSchema": [
    { "key": "score", "label": "Score", "type": "number", "required": true },
    { "key": "summary", "label": "Summary", "type": "long_text", "required": true }
  ],
  "config": {
    "type": "webhook",
    "webhook": {
      "url": "https://example.com/api/lead-score",
      "method": "POST",
      "requestBodyMode": "json"
    }
  },
  "changeSummary": "Initial version"
}
```

## 7.3 Manual run response

```json
{
  "tool": "custom/lead-qualification",
  "runId": "run_123",
  "title": "Lead Qualification",
  "summary": "Lead scored successfully.",
  "data": {
    "score": 82,
    "summary": "Warm lead. Follow up within 24 hours."
  },
  "createdAt": "2026-04-14T12:00:00.000Z"
}
```

---

## 8. Phase 2 Extensions

These should be deliberately deferred.

### 8.1 Skill unlock support for custom tools

Do not ship this in phase 1.

If added later, prefer a relation table such as:

```ts
skillUserToolGrant(skillId, userToolId, createdAt)
```

Why not reuse `skill.enabledTools`:

- current `enabledTools` is a built-in tool ID list
- custom tools need ownership and permission checks
- relational grants are easier to validate and audit

### 8.2 Template publishing

Later add:

- admin review
- clone behavior
- locked template fields

Follow the same direction used by admin-managed agents and skills.

---

## 9. Recommended First Milestone

The best first engineering milestone is:

1. `db/schema/user-tools.ts`
2. CRUD routes and builder page
3. webhook executor
4. `agentUserToolAttachment`
5. chat runtime merge
6. `toolRun` persistence with `toolKind = 'user_created'`

That is the smallest slice that proves the concept end to end:

- create tool
- attach to agent
- run manually
- run from chat
- inspect history

---

## Final Recommendation

Treat user-created tools as a **new dynamic tool layer**, not as fake built-in registry entries.

That means:

- separate DB ownership and versioning
- separate agent attachment model
- shared runtime conversion into AI SDK tools
- shared execution history through `toolRun`
- permission enforcement before every run

This approach keeps the current built-in tool architecture clean while making room for a powerful user-extensible system.
