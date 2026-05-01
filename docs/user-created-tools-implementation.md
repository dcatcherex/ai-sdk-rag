# User-Created Tools - Product and Implementation Proposal

This document defines how Vaja can support **user-created tools** as a future product capability.

Today, users can create:

- `agents` - role, system prompt, model, documents, enabled tools
- `skills` - contextual instructions, references, and optional tool unlocks

Users **cannot** create tools yet.

This proposal explains when user-created tools are valuable, how they should fit the existing architecture, and how to ship them safely in phases.

Read this after:

- `IMPLEMENTATION.md`
- `implementation_future.md`
- `docs/skills.md`
- `docs/google-workspace-tools-implementation.md`

Technical follow-up:

- `docs/user-created-tools-technical-plan.md`

---

## Implementation Status

Last updated: 2026-04-28

Current progress:

- Done: `db/schema/user-tools.ts` added with `userTool`, `userToolVersion`, `userToolShare`, `agentUserToolAttachment`, and `userToolConnection`
- Done: `features/user-tools/` backend feature boundary added with schema validation, queries, mutations, permissions, runtime, history, and webhook execution
- Done: API routes added for list/create/detail/version/test/run/history and agent attachments
- Done: agent runtime now merges attached user-created tools into the AI SDK toolset
- Done: control-room page added at `/user-tools` with tool list, JSON-based builder, test runner, and run history
- Done: the `/user-tools` page now supports editing existing tool metadata and saving new draft versions
- Done: the `/user-tools` draft flow now keeps a true unsaved draft state instead of snapping back to the first saved tool
- Done: the `/user-tools` editor now scrolls back to the top on new-draft reset and tool selection so the builder form stays visible
- Done: the `/user-tools` workspace now uses normal page flow instead of nested scroll panels so the builder cannot render as an empty middle column
- Done: the `/user-tools` UI now uses a two-column workbench with the runner stacked below the editor, preventing the builder from being squeezed by the sidebar layout
- Done: `toolRun` reused for custom-tool execution history
- Done: draft tools can now be published through a dedicated publish endpoint and UI action
- Done: manual test/run flows require explicit confirmation for write or confirmation-required tools
- Done: agent runtime tools use `needsApproval` for write or confirmation-required tools
- Done: webhook execution is hardened with HTTPS-only URLs, private/local destination blocking, redirect rejection, response-size limits, timeout caps, and restricted custom headers
- Done: agent editor now has a custom-tool attachment section for Phase 1 agent assignment
- Done: agent custom-tool attachment saves now validate that each selected tool is accessible to the current user, supports agent execution, and is not archived
- Done: targeted regression coverage was added for attachment normalization and server-side attachment validation
- Done: Drizzle migration file generated
- Done: database migration applied after reconciling pre-existing Drizzle ledger drift with `pnpm db:reconcile-migrations`
- Done: targeted tool sharing is now available for specific registered users with `runner` and `editor` roles
- Done: workspace-level sharing is now supported through brand-backed workspace shares, letting owners share a tool with all members of a selected workspace
- Done: workspace-shared tools now resolve access consistently in list/detail views, agent attachment validation, and agent runtime execution
- Done: workflow execution now supports declarative multi-step compositions that create native Vaja records through service-layer integrations
- Done: the `/user-tools` builder now supports both `webhook` and `workflow` execution types
- Done: workflow runs now persist richer artifacts for created campaign briefs, calendar entries, and social post drafts while returning artifact links in the unified tool result envelope
- Pending: richer visual builder for field editing
- Pending: skill-based unlocks for custom tools
- Pending: templates and broader publish/catalog flows

Phases 1 through 3 are now code-complete and migrated for the current scope: owner-created webhook tools, workspace sharing and agent assignment, and workflow tools that compose existing Vaja services into saved campaign, calendar, and social-draft records. Skill-based unlocks, template flows, and broader publishing remain later-phase work.

---

## Table of Contents

1. [Why This Matters](#1-why-this-matters)
2. [Product Decision](#2-product-decision)
3. [What a User-Created Tool Is](#3-what-a-user-created-tool-is)
4. [When to Use Agents, Skills, or Tools](#4-when-to-use-agents-skills-or-tools)
5. [User Value by Segment](#5-user-value-by-segment)
6. [Example Tool Types](#6-example-tool-types)
7. [Product Scope and Non-Goals](#7-product-scope-and-non-goals)
8. [Tool Creation UX](#8-tool-creation-ux)
9. [Runtime Architecture](#9-runtime-architecture)
10. [Database Design](#10-database-design)
11. [Permission and Safety Model](#11-permission-and-safety-model)
12. [Agent and Skill Interaction](#12-agent-and-skill-interaction)
13. [Tool Execution and History](#13-tool-execution-and-history)
14. [Publishing and Sharing Model](#14-publishing-and-sharing-model)
15. [Recommended Delivery Phases](#15-recommended-delivery-phases)
16. [Implementation Order](#16-implementation-order)
17. [Open Questions](#17-open-questions)

---

## 1. Why This Matters

Agents and skills make AI feel smarter.

Tools make AI able to **perform structured work**.

That difference matters:

- an agent can talk like a school administrator
- a skill can teach it how your school handles absences
- a tool can actually look up a student record, generate a follow-up message, and save the outcome

For many teams, the jump from "good answers" to "useful actions" is where product value increases sharply.

User-created tools would let customers encode their own workflows into Vaja instead of waiting for the platform team to build every domain-specific tool by hand.

---

## 2. Product Decision

Vaja should support **user-created tools**, but it should **not** start with arbitrary code execution.

The right first version is:

- **declarative tools**
- **schema-first**
- **permissioned**
- **audit logged**
- **workspace-aware**

The first release should focus on three safe tool families:

1. **Action tools**
   - call a webhook or structured API endpoint
   - useful for CRM, LMS, internal backends, and lightweight automations

2. **Workflow tools**
   - chain existing Vaja capabilities into one reusable action
   - useful for content, education, operations, and approvals

3. **Data tools**
   - read or write to approved structured sources such as Sheets, Drive, or platform tables
   - useful for recurring business workflows

Do **not** start with:

- freeform code uploads
- arbitrary shell execution
- arbitrary package install
- unrestricted outbound network access
- public marketplace publishing without review

---

## 3. What a User-Created Tool Is

A user-created tool is a **structured executable capability** defined mostly in data, not handwritten application code.

It should contain:

- metadata
- input schema
- output schema
- execution type
- execution configuration
- permission policy
- sharing settings

Examples:

- `student-followup`
- `lead-qualification`
- `line-broadcast-preview`
- `campaign-brief-creator`
- `brand-compliance-check`

At runtime, the system should turn this stored definition into the same kind of tool capability that built-in tools expose to agents.

---

## 4. When to Use Agents, Skills, or Tools

This should stay simple and product-facing:

| Capability | Use it for |
|-----------|------------|
| Agent | Identity, tone, ownership, model choice, base documents, base enabled tools |
| Skill | Contextual instructions, domain knowledge, reference files, trigger-based behavior, optional tool unlocks |
| Tool | Structured actions, integrations, retrieval, mutations, deterministic workflows, side effects |

Examples:

- "Speak like a Thai marketing strategist" -> agent
- "Use this school's parent communication policy" -> skill
- "Create a parent follow-up note and save it to CRM" -> tool

Important rule:

- a skill may **unlock** a tool for the current message
- a skill should **not replace** a tool when the work requires real structured execution or external side effects

---

## 5. User Value by Segment

### Education

Examples:

- `student-progress-summary`
- `tuition-followup`
- `quiz-result-export`
- `curriculum-alignment-check`

Benefits:

- less admin overhead
- more consistent messaging to parents
- reusable teaching workflows
- grounded outputs tied to actual records

### Marketing and Content Teams

Examples:

- `campaign-brief-generator`
- `line-broadcast-validator`
- `brand-approval-check`
- `content-calendar-entry-creator`

Benefits:

- repeatable planning workflows
- fewer formatting errors
- stronger brand consistency
- better handoff between strategy and execution

### SMEs and Operations Teams

Examples:

- `lead-intake`
- `quote-request-drafter`
- `appointment-summary`
- `invoice-reminder-preparer`

Benefits:

- AI becomes part of the real workflow
- less copy-paste between systems
- fewer manual checklist steps
- stronger workspace stickiness

---

## 6. Example Tool Types

### Type A - Webhook Action Tool

Example: `send-lead-to-crm`

- input: name, phone, source, notes
- action: POST to customer CRM webhook
- output: success, lead ID, timestamp

Best for:

- no-code integrations
- SMEs with lightweight internal systems

### Type B - Workflow Tool

Example: `launch-campaign-workflow`

- input: product, audience, goal, publish date
- steps:
  - generate campaign brief
  - generate 3 caption options
  - generate image prompt
  - save draft to calendar
- output: created draft IDs and summary

Best for:

- marketing teams
- repeatable multi-step processes

### Type C - Data Lookup Tool

Example: `student-status-lookup`

- input: student ID
- action: fetch attendance, grades, teacher notes
- output: normalized student summary

Best for:

- schools
- training centers
- operations teams

### Type D - Validation Tool

Example: `brand-compliance-check`

- input: content draft
- action: validate against saved brand rules
- output: pass/fail, issues, recommended fixes

Best for:

- approval flows
- quality control

---

## 7. Product Scope and Non-Goals

### Scope for v1

- user-created tools for authenticated workspace users
- schema-driven creation flow
- workspace-only sharing
- agent execution support
- sidebar/manual execution support
- persistent run history
- audit logging
- read/write safety flags

### Non-goals for v1

- public marketplace for any user-created tool
- arbitrary code execution
- arbitrary third-party credential storage without connection policies
- nested orchestration across many unknown external systems
- full MCP replacement

---

## 8. Tool Creation UX

The "Create Tool" flow should feel familiar to "Create Skill", but more structured and safety-oriented.

### Suggested sections

#### 1. General

- name
- description
- icon
- category
- visibility
- read-only or write action

#### 2. Inputs

Field builder with types such as:

- text
- long text
- number
- boolean
- enum
- date
- JSON
- file

Each field should support:

- required/optional
- label
- internal key
- help text
- example
- default value

#### 3. Action

Execution types:

- webhook/API request
- workflow composition
- Google Sheets action
- Google Drive action
- internal data query
- AI transform with structured output

#### 4. Output

- structured response schema
- user-facing success summary
- optional artifact definitions
- retryable vs non-retryable failure categories

#### 5. Access and Safety

- who can run it
- which agents can use it
- human confirmation required or not
- workspace-only or personal-only
- rate limit profile
- write guard settings

#### 6. Test

- test payload form
- dry-run if supported
- response preview
- error preview
- audit preview

### UX principle

Users should never need to think in terms like `manifest.ts` or `agent.ts`.

They should think in terms of:

- what information the tool needs
- what action it performs
- what result it returns
- who is allowed to use it

---

## 9. Runtime Architecture

The existing tool architecture is strong and should remain the foundation:

- built-in tools are code-defined
- user-created tools should be data-defined
- both should become a common runtime tool format

### Core rule

Built-in tools keep the current pattern:

- `manifest.ts`
- `schema.ts`
- `service.ts`
- `agent.ts`

User-created tools should use a **dynamic runtime adapter** instead of handwritten files.

### Proposed runtime shape

1. Load base built-in tools from the existing registry
2. Load user-created tools allowed for this request
3. Convert DB-stored tool definitions into runtime tool handlers
4. Merge built-in and user-created tools into one `ToolSet`

Conceptually:

```ts
const builtInTools = buildToolSet(...);
const customTools = await buildUserCreatedToolSet(...);
const activeTools = { ...builtInTools, ...customTools };
```

### New runtime layer

Suggested server files:

- `features/user-tools/service.ts`
- `features/user-tools/runtime.ts`
- `features/user-tools/executors/webhook.ts`
- `features/user-tools/executors/workflow.ts`
- `features/user-tools/executors/sheets.ts`
- `features/user-tools/executors/internal-query.ts`
- `features/user-tools/schema.ts`
- `features/user-tools/types.ts`

### Why a new feature boundary

User-created tools are a product area, not a one-off extension of the current registry.

They need:

- dedicated persistence
- generic execution infrastructure
- permission enforcement
- testing UI
- audit history

---

## 10. Database Design

This should live under `db/schema/` as a dedicated domain.

Suggested tables:

### `userTool`

The stable identity record.

Suggested fields:

- `id`
- `userId`
- `workspaceId` or future workspace owner reference
- `name`
- `slug`
- `description`
- `icon`
- `category`
- `executionType`
- `visibility` (`private` | `workspace` | `template` | `published`)
- `status` (`draft` | `active` | `archived`)
- `readOnly`
- `requiresConfirmation`
- `createdAt`
- `updatedAt`

### `userToolVersion`

Immutable or semantically versioned configuration snapshot.

Suggested fields:

- `id`
- `toolId`
- `version`
- `inputSchemaJson`
- `outputSchemaJson`
- `configJson`
- `changeSummary`
- `createdByUserId`
- `createdAt`

### `userToolAccess`

Per-user, per-role, or per-agent access policy.

Suggested fields:

- `id`
- `toolId`
- `agentId` nullable
- `userId` nullable
- `role`
- `isEnabled`
- `createdAt`
- `updatedAt`

### `userToolConnection`

Referenced external connection configuration.

Suggested fields:

- `id`
- `toolId`
- `connectionType`
- `connectedAccountId` nullable
- `secretRef`
- `configJson`
- `createdAt`
- `updatedAt`

### `userToolTestRun`

Optional lightweight testing record before full publication.

Suggested fields:

- `id`
- `toolVersionId`
- `userId`
- `inputJson`
- `outputJson`
- `status`
- `createdAt`

### Reuse existing future direction

For real execution history, prefer aligning with the existing future tool history direction:

- `toolRun`
- `toolArtifact`

If those tables are introduced first, user-created tools should reuse them instead of inventing a second execution-history system.

---

## 11. Permission and Safety Model

This is the most important part of the feature.

User-created tools are more dangerous than skills because they can perform actions, write data, or call external systems.

### Required safety fields

Every tool should declare:

- read-only or write
- confirmation required or not
- allowed execution sources (`agent`, `sidebar`, `api`)
- allowed users or roles
- allowed agents
- rate limit profile
- network/integration scope

### Write safety

Examples of tools that should require confirmation by default:

- send broadcast
- create invoice
- update CRM status
- append to official student record
- export and send customer list

Examples of tools that can usually run without confirmation:

- lookup student summary
- preview certificate data
- validate brand compliance
- build a draft campaign brief

### Secret handling

Users should never paste secrets into tool prompts or raw tool bodies.

Use:

- connected accounts
- encrypted secret references
- approved connection records

Do not use:

- plain text credentials in `configJson`
- user-visible secret echoing

### Audit and explainability

Every tool run should log:

- who ran it
- from which source
- which agent invoked it
- input summary
- output summary
- whether it changed external data
- whether confirmation was shown

---

## 12. Agent and Skill Interaction

This feature should work cleanly with the current agent and skill model.

### Agents

Agents should be able to:

- have base access to selected user-created tools
- expose those tools in chat when allowed
- use those tools directly if enabled

### Skills

Skills should be able to:

- instruct the model when to use a user-created tool
- optionally unlock that tool for the current message

Example:

- an agent for a school counselor has access to `student-status-lookup`
- a `parent-followup-policy` skill teaches tone and escalation policy
- when the skill activates, it can also unlock `tuition-followup`

This keeps the model clean:

- the tool does the structured action
- the skill explains when and how to use it

### Important product rule

Skills should not become a workaround for unsafe tool access.

If a user is not allowed to use a tool directly, a skill should not silently bypass that policy.

So the final tool merge must still respect permission rules after any skill-based unlock.

---

## 13. Tool Execution and History

The tool experience should feel unified whether a tool is:

- built-in
- user-created
- called manually
- called by an agent

### Manual use

Users should be able to:

- open a tool page
- fill inputs
- test it
- inspect output
- rerun it
- clone a previous run

### Agent use

Agents should be able to:

- call the tool during chat
- link to a result page or saved run
- reuse the same execution envelope as manual runs

### Result model

User-created tools should return the same normalized result shape already used by built-in tools:

- `tool`
- `runId`
- `title`
- `summary`
- `data`
- `artifacts`
- `createdAt`

This keeps:

- audit
- run history
- result detail
- export behavior

consistent across the system.

---

## 14. Publishing and Sharing Model

Do not begin with an open public marketplace.

### Recommended progression

#### Stage 1 - Personal

- only creator can use the tool

#### Stage 2 - Workspace

- share with team members
- assign to specific agents

#### Stage 3 - Template

- save as a reusable template
- other users clone but do not automatically trust the original connection config

#### Stage 4 - Published

- admin-reviewed
- catalog-listed
- limited to safe execution types

This mirrors the pattern already emerging in agents and skills:

- personal creation first
- controlled sharing second
- published catalog later

---

## 15. Recommended Delivery Phases

### Phase 1 - Foundations

Ship:

- DB schema
- generic user-tool runtime
- webhook action tools
- test UI
- audit logging
- personal-only visibility

Status on 2026-04-28:

- code-complete for the owner-created webhook tool slice
- migration applied successfully after reconciling missing Drizzle ledger entries with `pnpm db:reconcile-migrations`
- workflow tools and workspace/template sharing are deferred beyond Phase 1

Do not ship yet:

- public sharing
- advanced integrations
- code execution

### Phase 2 - Workspace Tools

Ship:

- workspace sharing
- per-agent tool access
- confirmation UI for write tools
- persistent run history

### Phase 3 - Workflow Tools

Ship:

- multi-step composition
- save drafts to other Vaja systems
- richer result artifacts

Status on 2026-04-28:

- completed for the initial declarative workflow slice
- workflow steps now support creating campaign briefs, content calendar entries, and social post drafts through service-layer calls
- builder support for `workflow` execution is available on `/user-tools`
- workflow run outputs now include persisted artifacts and artifact links in the standard tool result shape

### Phase 4 - Integrations and Templates

Ship:

- reusable templates
- connected account bindings
- admin-reviewed catalog entries

### Phase 5 - Advanced Trusted Tools

Potential future:

- MCP-backed tools
- reviewed script runners
- advanced admin-only connectors

This should happen only after permission, audit, and billing models are stable.

---

## 16. Implementation Order

Recommended order:

1. Add `user-tools` feature boundary and DB schema
2. Implement webhook execution type and generic runtime adapter
3. Add "Create Tool" UI with schema builder and test panel
4. Add permission checks and confirmation support
5. Add run persistence using `toolRun` and `toolArtifact`
6. Add per-agent assignment and chat runtime loading
7. Add skill-based tool unlock support for user-created tools
8. Add workspace sharing
9. Add workflow composition tools
10. Add admin-reviewed publishing

Progress on 2026-04-28:

- completed for Phase 1: 1, 2, 3, 4, 5, 6
- deferred beyond Phase 1: 7, 8, 9, 10
- UX follow-up completed: the builder now makes "new draft" state visible and does not auto-reselect the first tool after reset

---

## 17. Open Questions

These should be answered before implementation begins:

1. Should user-created tools appear inside the existing `/tools/[toolSlug]` route, or should custom tools use a generic page such as `/tools/custom/[slug]`?

2. Should tool schemas be stored as JSON Schema, Zod-compatible JSON, or a simpler Vaja-specific field definition?

3. Which write actions require mandatory user confirmation, even when invoked by an agent?

4. Should agent tool access be allowlist-only, or can an agent see every workspace tool unless explicitly denied?

5. How should billing work for tool executions that call external APIs or chain multiple internal operations?

6. Should templates clone into a fully editable copy, or support a locked template model similar to admin-managed agents and skills?

7. When a skill unlocks a user-created tool, should the tool be available only for that single request or for the whole thread session?

---

## Final Recommendation

User-created tools are worth building because they let Vaja move from "AI that knows your work" to "AI that can perform your workflows."

The safest and strongest path is:

- start with declarative tools
- keep execution types narrow
- enforce permissions and audit from day one
- reuse the existing tool result model
- let agents and skills orchestrate tool access, but never bypass tool permissions

If done this way, user-created tools can become one of Vaja's strongest product differentiators for Thai schools, SMEs, marketers, and team-based AI work.
