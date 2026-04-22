# Agent Context And Governance Spec

> Audience: product, backend, and frontend developers designing agents, brands, workspace governance, and profession-specific context.
> Purpose: define how agents should interact with brand context, workspace context, shared ownership, and profession-specific operating context across marketing and non-marketing use cases.

---

## Status

Current status of this spec:

- this spec is **partially implemented**
- the brand-specific near-term recommendations are now shipped
- the generalized multi-context architecture in this spec is still future-state

Implemented from this spec:

- explicit agent brand behavior instead of a simple enable/disable toggle
- user and admin agent editing for:
  - `brandMode`
  - `brandAccessPolicy`
  - `requiresBrandForRun`
  - `fallbackBehavior`
- shared runtime resolution for:
  - chat
  - prompt preview
  - team chat
  - public shared-agent chat
- `workspace_only` enforcement using the current `workspace_member` model

Not implemented yet from this spec:

- generalized `contextType` beyond brand
- generic `workspace context` or `contextRecord` tables
- profession-specific context types such as:
  - `school`
  - `farm`
  - `clinic`
  - `department`
- broader ownership scopes beyond the current agent/catalog model
- a unified generic context-binding layer separate from brand

Practical conclusion:

- the **brand-governance subset** of this spec is implemented
- the **full multi-profession context-governance model** remains a later phase

---

## 1. Executive Summary

The current product already has strong building blocks:

- agents can be shared
- agents can be admin-managed
- agents can be templates
- agents can be bound to a `brandId`
- brands already hold reusable context and governance

What is still missing is a clean model for:

1. When an agent should use a brand.
2. How shared or admin-created agents behave across teams.
3. How the same concept should work for professions where "brand" is not the main context.
4. How to keep governance, permissions, and efficiency high as the platform grows.

### Core recommendation

Do not model this as a single `enable brand` toggle.

Instead, introduce:

- `Agent Scope` = who owns and can use the agent
- `Context Mode` = whether the agent uses no context, optional context, suggested context, or locked context
- `Context Type` = what kind of context the agent consumes
- `Workspace Context` = the broad operating layer for all professions
- `Brand Context` = one specialized subtype of workspace context, especially important for marketing

This gives a model that works for:

- a general agent shared to all users
- a workspace-specific customer service agent
- a locked company marketing agent
- a teacher assistant bound to a school/curriculum context
- a farmer assistant bound to a farm profile and crop cycle

---

## 2. Product Principles

### Principle 1: Agents should be reusable, but not context-confused

A shared agent should not accidentally carry the wrong brand or organization context into another user's work.

### Principle 2: Context is layered

The system should distinguish between:

- organization or workspace rules
- brand identity
- profession-specific operating data
- per-agent behavior
- per-task or per-thread inputs

### Principle 3: Brand is important, but not universal

Brand matters strongly for marketers, restaurants, creators, and SMEs.
For teachers, farmers, clinics, and public-sector users, other context types are equally or more important.

### Principle 4: Governance must be explicit

Users should always be able to tell:

- what context an agent is using
- whether that context is optional or locked
- who owns the context
- whether they may override it

### Principle 5: Shared agents need safe defaults

If an agent is intended to be broadly reusable, it should default to:

- no locked brand
- optional accessible context
- clear fallback behavior when context is missing

---

## 3. Key Concepts

### 3.1 Agent Scope

`Agent Scope` describes who owns and who can discover or use the agent.

Recommended values:

- `personal`
- `workspace`
- `organization`
- `public_template`
- `system_template`

Meaning:

- `personal`: private to one user unless explicitly shared
- `workspace`: intended for members of one workspace or one brand/workspace unit
- `organization`: available across multiple workspaces under one organization
- `public_template`: reusable starter published to many users
- `system_template`: admin-managed built-in agent

This should be modeled separately from `isPublic`.

### 3.2 Context Type

`Context Type` describes the domain object that shapes agent output.

Recommended values:

- `none`
- `brand`
- `workspace`
- `school`
- `farm`
- `clinic`
- `department`
- `custom`

Meaning:

- `brand`: voice, visual identity, positioning, messaging
- `workspace`: org rules, team settings, shared preferences, access rules
- `school`: grade range, curriculum, term calendar, school tone, subject rules
- `farm`: crop profile, location, seasonal plan, budget, input preferences
- `clinic`: specialty, patient communication rules, protocols, disclaimers
- `department`: official tone, policy references, document templates, approval chain

### 3.3 Context Mode

`Context Mode` controls how strictly the agent uses a context record.

Recommended values:

- `none`
- `optional`
- `suggested`
- `locked`

Meaning:

- `none`: never use stored context
- `optional`: use currently selected accessible context if present
- `suggested`: agent ships with a preferred context, but user can switch
- `locked`: agent always uses one specific context and user cannot change it

This is the key product behavior and should replace the simple idea of `enable brand`.

### 3.4 Context Access Policy

`Context Access Policy` describes which contexts the agent is allowed to consume.

Recommended values:

- `no_context`
- `any_accessible`
- `workspace_only`
- `organization_only`
- `specific_context`

Examples:

- A public general tutor: `any_accessible`
- A company social media agent: `specific_context`
- A school lesson-plan agent: `workspace_only`
- A cross-brand writing helper: `any_accessible`

---

## 4. Recommended Agent Model

### Current state

The current `agent` table already has:

- `brandId`
- `catalogScope`
- `managedByAdmin`
- `cloneBehavior`
- `updatePolicy`
- `lockedFields`

This is a strong base.

### Recommended additions to agent schema

Add these columns:

```ts
contextType: text("context_type").notNull().default("none")
contextMode: text("context_mode").notNull().default("none")
contextAccessPolicy: text("context_access_policy").notNull().default("any_accessible")
contextId: text("context_id")
ownerScope: text("owner_scope").notNull().default("personal")
requiresContextForRun: boolean("requires_context_for_run").notNull().default(false)
fallbackBehavior: text("fallback_behavior").notNull().default("ask_or_continue")
```

### How these fields work

- `contextType`: which kind of context this agent is designed for
- `contextMode`: whether the context is optional, suggested, or locked
- `contextAccessPolicy`: which records the runtime may select
- `contextId`: the specific bound record for `suggested` or `locked`
- `ownerScope`: higher-level visibility or ownership scope beyond the current public/private split
- `requiresContextForRun`: whether the agent should stop and ask if no valid context is available
- `fallbackBehavior`: what to do when required context is missing

### Backward-compatible interpretation

Before a broader context system exists:

- `brandId != null` can be interpreted as:
  - `contextType = 'brand'`
  - `contextMode = 'locked'`
  - `contextAccessPolicy = 'specific_context'`
  - `contextId = brandId`

This lets you migrate incrementally.

---

## 5. Recommended Context Runtime Model

At runtime, the agent should resolve context using a consistent layered order.

### Resolution order

1. Locked agent context
2. Suggested agent context if still valid and user has access
3. Current workspace-selected context
4. Default context for the workspace or user
5. No context

### Effective context assembly

Build a combined context block from layers:

1. Organization or workspace context
2. Specialized context record
   - brand, school, farm, clinic, department, etc.
3. Agent-specific system prompt
4. Skills
5. Task input

### Example

Marketing agent:

```text
Workspace context
-> EdLab workspace rules, approval norms, default channels

Brand context
-> EdLab Experience brand voice, colors, audience, proof points

Agent context
-> "You are a social campaign strategist"

Task context
-> "Create a back-to-school LINE campaign for Grade 10 families"
```

Teacher agent:

```text
Workspace context
-> school-wide policy, communication style, common templates

School context
-> curriculum, grade levels, exam rules, academic calendar

Agent context
-> "You are a lesson planner for upper secondary science"

Task context
-> "Write a 50-minute lesson for photosynthesis"
```

---

## 6. Brand Mode For Agents

### Recommended product behavior

For now, when the context type is still mostly `brand`, use these modes in the UI:

- `No Brand`
- `Use Selected Brand If Available`
- `Prefer This Brand`
- `Lock To This Brand`

### Semantics

`No Brand`

- The agent is general.
- It ignores brand context even if the user has selected one.
- Best for broad reusable assistants.

`Use Selected Brand If Available`

- The agent uses the user's currently selected accessible brand.
- If none is selected, it still works.
- Best for reusable copy, image, and campaign assistants.

`Prefer This Brand`

- The agent opens with a suggested brand preselected.
- The user may change it if permissions allow.
- Best for team templates.

`Lock To This Brand`

- The agent always uses one exact brand.
- The user cannot swap it.
- Best for official company-owned or campaign-critical agents.

### Recommendation for admin-created agents

Admins or heads of team should create most shared agents using either:

- `No Brand`
- `Use Selected Brand If Available`
- `Prefer This Brand`

Use `Lock To This Brand` only for:

- official brand guardians
- customer-facing brand-specific assistants
- company-owned campaign agents
- regulated or high-risk flows where wrong context is costly

---

## 7. Shared Agent Permissions

Shared agents need both discovery permissions and context permissions.

### Proposed permission dimensions

1. `Visibility`
2. `Use`
3. `Edit`
4. `Clone`
5. `Override context`
6. `Use locked context`
7. `Share onward`

### Recommended roles

For agent ownership:

- `owner`
- `admin_manager`
- `editor`
- `operator`
- `viewer`

For context ownership:

- `context_owner`
- `context_editor`
- `context_user`

### Recommended rules

- A user may run a shared agent only if they also have access to the context it resolves.
- If the agent is `locked` to a context the user cannot access, hide it or mark it unavailable.
- Public templates must never contain hidden or private locked contexts.
- Workspace agents may default to workspace contexts but should not leak private organization data when cloned or shared publicly.

### Suggested UX labels

- `Shared with workspace`
- `Managed by admin`
- `Uses selected brand`
- `Locked to EdLab Experience`
- `Requires school context`

This kind of labeling prevents confusion and improves trust.

---

## 8. Generalizing Beyond Marketing

Brand should become one subtype of a broader context system.

### 8.1 Teacher / School context

Recommended context fields:

- school name
- grade levels served
- curriculum framework
- term calendar
- assessment style
- classroom tone
- parent communication policy
- banned topics or compliance notes
- school templates and exemplars

High-value agents:

- lesson planner
- worksheet generator
- quiz builder
- report-comment writer
- parent message assistant

### 8.2 Farmer / Farm context

Recommended context fields:

- farm name
- location
- crop types
- field size
- season calendar
- budget level
- preferred inputs
- disease history
- labor constraints
- sales channels and buyer preferences

High-value agents:

- crop advisory assistant
- season planner
- pest triage assistant
- farm record helper
- market sales assistant

### 8.3 Healthcare / Clinic context

Recommended context fields:

- clinic or facility name
- specialty
- communication rules
- care pathway summaries
- escalation rules
- disclaimers
- approved resources
- appointment workflow

High-value agents:

- patient communication helper
- intake summary assistant
- care follow-up assistant
- clinic content assistant

### 8.4 Government / Department context

Recommended context fields:

- department name
- official language style
- document templates
- law or regulation references
- approval hierarchy
- citizen service tone
- prohibited wording

High-value agents:

- official letter drafter
- form assistant
- policy explainer
- internal memo assistant

### 8.5 SME / Business operator context

Recommended context fields:

- business identity
- product catalog
- pricing norms
- sales channels
- customer service rules
- brand identity
- operating hours
- common FAQs

This is often a combination of:

- workspace context
- brand context
- product knowledge

---

## 9. Corporate Efficiency And What Is Easy To Miss

When scaling from solo users to teams and organizations, the biggest missing pieces are usually governance and inheritance, not generation quality.

### 9.1 Context inheritance

Recommended inheritance chain:

```text
Organization
-> Workspace
-> Context record (brand/school/farm/etc.)
-> Agent
-> Thread or task
```

Without inheritance, teams end up duplicating context everywhere.

### 9.2 Locked vs editable fields

Admins need to decide which parts are centrally managed.

Examples:

- locked:
  - official disclaimers
  - approved brand colors
  - curriculum framework
  - compliance rules
- editable:
  - starter prompts
  - local task notes
  - campaign details
  - temporary thread overrides

### 9.3 Versioning

You will likely need versioning for:

- context records
- agent templates
- prompt blocks
- guardrails

Otherwise teams cannot audit why output changed.

### 9.4 Approval gates

Not all tasks should be equally autonomous.

Examples:

- social draft: may require editor approval
- patient advice: should be heavily constrained
- official announcement: should require department approval
- classroom worksheet: usually lower-risk and can be self-service

### 9.5 Channel variants

One brand or one organization may need multiple output modes:

- LINE OA voice
- email voice
- website voice
- formal memo voice
- student-facing voice
- parent-facing voice

This should be handled as channel-specific extensions, not separate cloned brands whenever possible.

### 9.6 Shared asset governance

Assets should support:

- role-based access
- approved vs draft state
- collection tagging
- primary/default designation
- audit trail

### 9.7 Setup completeness

Agents and contexts should expose readiness status:

- `draft`
- `basic`
- `operational`
- `governed`

This helps admins know whether a team is ready to delegate more work.

### 9.8 Safe fallback behavior

When required context is missing, the system should not guess silently.

Possible fallback modes:

- ask user to choose a context
- continue in generic mode
- block run and request setup
- use workspace default

This should be explicit per agent.

---

## 10. Recommended Data Model Evolution

### Phase 1: improve current brand-bound agent model

Keep current architecture but add agent behavior controls.

Suggested new `agent` fields:

```ts
brandMode: text("brand_mode").notNull().default("optional")
brandAccessPolicy: text("brand_access_policy").notNull().default("any_accessible")
requiresBrandForRun: boolean("requires_brand_for_run").notNull().default(false)
fallbackBehavior: text("fallback_behavior").notNull().default("ask_or_continue")
```

Recommended values:

- `brandMode`: `none | optional | suggested | locked`
- `brandAccessPolicy`: `no_brand | any_accessible | workspace_only | specific_brand`

This gives a fast path without building the full generic context system immediately.

### Phase 2: introduce generalized context tables

When ready, add a generic context layer.

Example:

```ts
contextRecord
  id
  ownerUserId
  ownerScope
  contextType
  name
  status
  configJson
  createdAt
  updatedAt

contextShare
  id
  contextId
  sharedWithUserId
  role
  createdAt

agentContextBinding
  id
  agentId
  contextType
  contextMode
  contextAccessPolicy
  contextId
  createdAt
  updatedAt
```

### Why not jump immediately to fully generic?

Because `brand` already exists and is valuable now.

Recommended sequencing:

1. make brand-mode and agent governance explicit
2. harden shared-agent behavior
3. generalize the context model once real non-marketing workflows are active

---

## 11. Admin UX Recommendations

### Agent editor additions

Add a `Context` section to the agent editor.

Recommended controls:

- `Context type`
- `Context mode`
- `Suggested/locked context`
- `Fallback behavior`
- `Visibility scope`
- `Who can override context`

### Admin or head-of-team use cases

#### Case A: general shared agent

- context type: `none`
- context mode: `none`
- visibility: `workspace` or `organization`

Use for:

- general research
- meeting notes
- translation
- coding

#### Case B: reusable context-aware agent

- context type: `brand` or `school` or `farm`
- context mode: `optional`
- access policy: `any_accessible`

Use for:

- copy assistant
- lesson assistant
- crop planner

#### Case C: recommended official template

- context type: `brand`
- context mode: `suggested`
- context id: official workspace brand

Use for:

- social team starter agent
- official customer service assistant

#### Case D: locked corporate agent

- context type: `brand` or `department`
- context mode: `locked`
- override disabled

Use for:

- official PR assistant
- formal government drafting assistant
- regulated patient communications agent

---

## 12. Suggested UI Copy

### Agent form labels

- `Context`
- `This agent works best with`
- `How should this agent use context?`
- `Users can switch context`
- `Lock this agent to one context`
- `Run in general mode when no context is selected`

### Brand-specific quick version

If you want a short-term UX before general context ships:

- `Brand mode`
- `No brand`
- `Use selected brand`
- `Prefer this brand`
- `Lock to this brand`

This is much clearer than `Enable brand`.

---

## 13. Implementation Recommendation

### Near-term recommendation

Do this first:

1. Keep `brand` as canonical.
2. Add `brandMode` and `brandAccessPolicy` to `agent`.
3. Update the agent editor UI to expose those modes.
4. Make shared agents context-safe.
5. Move toward one canonical brand/context system as described in the brand refactor plan.

### Mid-term recommendation

After the brand refactor is stable:

1. Introduce a broader `Workspace Context` concept.
2. Treat brand as one specialized context type.
3. Add profession-specific context records for school, farm, clinic, and department use cases.

### Long-term recommendation

Unify runtime prompt assembly around:

- workspace context
- specialized context
- skills
- agent prompt
- task prompt

This will scale much better than adding more and more special-case prompt blocks per profession.

---

## 14. Final Recommendation

The best product shape is:

- general agents can stay truly general
- shared agents can be context-aware without being context-locked by accident
- official agents can be locked to one brand or one operational context
- non-marketing professions can use the same architecture through context types beyond brand

So the answer to "should admin use a page to enable brand for agents?" is:

- not as a simple toggle
- yes as a structured `Context` section with explicit modes, scope, permissions, and fallback behavior

That is the cleanest model for brand efficiency, admin governance, and future expansion to teachers, farmers, healthcare, and government workflows.
