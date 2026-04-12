# Admin-Managed Agents And Skills Implementation Guide

## Purpose

This document defines a concrete implementation plan for **admin-managed, ready-to-use agents and skills** inside Vaja.

The goal is to let admins:

- create official starter agents and skills
- edit and publish them centrally
- make them available to all users
- let users use them immediately
- allow safe customization without breaking user-owned work

This guide is intentionally shaped around the current codebase, not an abstract future platform.

---

## Problem Statement

Today Vaja already supports:

- user-created agents
- system agent templates
- user-created skills
- public/community skills
- skill installation by cloning a public skill into the user's library

That gives users flexibility, but it does not yet give admins a complete way to manage a curated, official starter catalog.

Current gaps:

- agent templates exist, but their lifecycle is still thin
- skills do not yet have a first-class system template model
- there is no admin UI for publishing official agents or skills
- there is no version/update policy for admin-managed templates
- users cannot clearly distinguish `official essentials` from `my copies`

The result is a weaker ready-to-use experience than the product vision wants.

---

## Current State In The Repo

### Admin access model

The admin surface is currently internal-only:

- `app/admin/*`
- `app/api/admin/*`
- `lib/admin.ts`

Admin access is enforced through `requireAdmin()` and `ADMIN_EMAILS`.

Important implication:

- v1 of admin-managed agents and skills should ship as an **internal admin console feature**
- it should not assume workspace-owner or organization-admin roles yet

### Agents today

Agents already have partial template support in:

- [db/schema/agents.ts](/d:/vscode2/nextjs/ai-sdk/db/schema/agents.ts)
- [app/api/agents/route.ts](/d:/vscode2/nextjs/ai-sdk/app/api/agents/route.ts)
- [app/api/agents/templates/[id]/use/route.ts](/d:/vscode2/nextjs/ai-sdk/app/api/agents/templates/[id]/use/route.ts)

Relevant existing fields:

- `userId` can already be `null`
- `isTemplate`
- `templateId`
- `isDefault`

Current behavior:

- system templates are queried as `userId IS NULL AND isTemplate = true`
- users can create a usable copy through `/api/agents/templates/[id]/use`

This is a strong foundation and should be extended, not replaced.

### Skills today

Skills are currently user-owned or public/community items in:

- [db/schema/skills.ts](/d:/vscode2/nextjs/ai-sdk/db/schema/skills.ts)
- [app/api/skills/route.ts](/d:/vscode2/nextjs/ai-sdk/app/api/skills/route.ts)
- [features/skills/server/mutations.ts](/d:/vscode2/nextjs/ai-sdk/features/skills/server/mutations.ts)
- [features/skills/server/queries.ts](/d:/vscode2/nextjs/ai-sdk/features/skills/server/queries.ts)

Current behavior:

- `agentSkill.userId` is required
- `isPublic` is used for community visibility
- install flow clones a public skill into the user's own skill library

There is no equivalent of `system template skill` yet.

---

## Product Decision

The product should use a **copy-based admin template model**, not direct admin editing of user-owned records.

### Core rule

Admins manage the **source template**.

Users work with either:

- the original template in locked/use-only mode
- or a cloned personal copy

Admins should **not** directly mutate a user's customized copy by default.

### Why this model is best

It prevents several common problems:

- admin edits accidentally changing a user's live workflow
- support issues from silent prompt/tool changes
- unclear ownership of agent or skill behavior
- hard-to-debug regressions after template updates

It also fits the existing agent template pattern and the current skill install pattern.

---

## Recommended Product Language

For end users, use clearer labels than raw `template`.

### Agents page

Recommended tabs:

- `Essentials`
- `Mine`
- `Shared`

Optional future tab:

- `Community`

### Skills page

Recommended tabs:

- `Essential skills`
- `My skills`
- `Community`

### Admin console

Recommended page labels:

- `Admin Agents`
- `Admin Skills`

Inside admin, `template` is acceptable as an implementation term.

Inside user-facing UI, `Essentials` is clearer and more outcome-oriented.

---

## Scope For V1

V1 should focus on the smallest useful slice:

- internal admin can create official agent essentials
- internal admin can create official skill essentials
- official items are visible to all signed-in users
- users can `Use` or `Duplicate` them
- admin can publish, unpublish, archive, and update them
- users can see when a newer template version exists

V1 should **not** include:

- per-workspace targeting
- per-team targeting
- complex RBAC beyond current admin access
- direct admin editing of user-owned copies
- automatic force-push updates into editable user copies

Those can come later after the org/workspace model is stronger.

---

## User Experience Model

Each admin-managed agent or skill should support one of these usage modes.

### 1. Locked use

The user can run the official item as-is.

Good for:

- safety-sensitive assistants
- compliance or brand rules
- carefully tuned agents

### 2. Duplicate and customize

The user starts from the official item, then creates a personal copy.

Good for:

- most agents
- most reusable skills
- localized or role-specific tweaks

### 3. Suggest update

If the admin updates the source template, user copies show:

- `Update available`
- source version
- current copy version

The user can review and apply the update manually or duplicate a fresh copy.

This should be the default for editable copies in v1.

---

## Data Model Decision

The implementation should keep agents and skills in their existing tables, but make their management metadata more explicit.

This avoids building a separate catalog system while still giving the product the right behavior.

### Agent schema changes

Extend [db/schema/agents.ts](/d:/vscode2/nextjs/ai-sdk/db/schema/agents.ts).

Keep:

- `isTemplate`
- `templateId`
- `isDefault`

Add:

```ts
catalogScope: text("catalog_scope").notNull().default("personal")
catalogStatus: text("catalog_status").notNull().default("draft")
managedByAdmin: boolean("managed_by_admin").notNull().default(false)
cloneBehavior: text("clone_behavior").notNull().default("editable_copy")
updatePolicy: text("update_policy").notNull().default("notify")
lockedFields: text("locked_fields").array().notNull().default(sql`'{}'::text[]`)
version: integer("version").notNull().default(1)
sourceTemplateVersion: integer("source_template_version")
publishedAt: timestamp("published_at")
archivedAt: timestamp("archived_at")
changelog: text("changelog")
```

Recommended enums:

- `catalogScope`: `personal | system`
- `catalogStatus`: `draft | published | archived`
- `cloneBehavior`: `locked | editable_copy`
- `updatePolicy`: `none | notify | auto_for_locked`

### Skill schema changes

Extend [db/schema/skills.ts](/d:/vscode2/nextjs/ai-sdk/db/schema/skills.ts).

Important change:

- make `agentSkill.userId` nullable so system-owned skills can exist cleanly

Add fields parallel to agents:

```ts
isTemplate: boolean("is_template").notNull().default(false)
templateId: text("template_id")
catalogScope: text("catalog_scope").notNull().default("personal")
catalogStatus: text("catalog_status").notNull().default("draft")
managedByAdmin: boolean("managed_by_admin").notNull().default(false)
cloneBehavior: text("clone_behavior").notNull().default("editable_copy")
updatePolicy: text("update_policy").notNull().default("notify")
lockedFields: text("locked_fields").array().notNull().default(sql`'{}'::text[]`)
version: integer("version").notNull().default(1)
sourceTemplateVersion: integer("source_template_version")
publishedAt: timestamp("published_at")
archivedAt: timestamp("archived_at")
changelog: text("changelog")
```

Recommended rule:

- `isPublic` continues to mean community/public sharing
- it should **not** be overloaded to mean `official admin essential`

That distinction matters:

- `isPublic = true` means community installable
- `catalogScope = system` and `managedByAdmin = true` means official essential

### Why not build new template tables now

Using the existing `agent` and `agentSkill` tables keeps:

- copy flows simple
- query logic familiar
- migration risk smaller
- existing hooks and editors reusable

Separate template tables would add more joins and duplicate field shapes without enough payoff in v1.

---

## TypeScript Contracts

Update:

- [features/agents/types.ts](/d:/vscode2/nextjs/ai-sdk/features/agents/types.ts)
- [features/skills/types.ts](/d:/vscode2/nextjs/ai-sdk/features/skills/types.ts)

Add shared metadata fields to both `Agent` and `Skill` types:

- `catalogScope`
- `catalogStatus`
- `managedByAdmin`
- `cloneBehavior`
- `updatePolicy`
- `lockedFields`
- `version`
- `sourceTemplateVersion`
- `publishedAt`
- `archivedAt`
- `changelog`

For skills, also add:

- `isTemplate`
- `templateId`
- `userId: string | null`

---

## Canonical Behavior Rules

### Rule 1

Admin-managed essentials are source templates, not user-owned working copies.

### Rule 2

User customization happens on a duplicate unless the template is explicitly locked-use.

### Rule 3

Publishing is a separate state from creation.

Draft templates should not appear in the user catalog.

### Rule 4

Archiving removes an item from future discovery but should not delete user-owned copies.

### Rule 5

Admin-managed official items should be distinguishable from public/community items in both data and UI.

### Rule 6

Agent and skill management flows should reuse the domain service layers, not move core logic into admin routes.

---

## Service Layer Design

Keep business logic in domain features, with thin admin routes on top.

### Recommended modules

New server modules:

- `features/agents/server/catalog.ts`
- `features/skills/server/catalog.ts`

These modules should own:

- listing admin templates
- listing user-visible essentials
- publishing and archiving
- cloning from templates
- version comparison
- update-available calculation

Admin routes should validate input, call these services, and return JSON.

Do not place core catalog logic directly in `app/api/admin/...`.

---

## API Design

### Admin APIs

Add:

- `GET /api/admin/agents`
- `POST /api/admin/agents`
- `GET /api/admin/agents/[id]`
- `PUT /api/admin/agents/[id]`
- `POST /api/admin/agents/[id]/publish`
- `POST /api/admin/agents/[id]/archive`
- `POST /api/admin/agents/[id]/duplicate`

- `GET /api/admin/skills`
- `POST /api/admin/skills`
- `GET /api/admin/skills/[id]`
- `PUT /api/admin/skills/[id]`
- `POST /api/admin/skills/[id]/publish`
- `POST /api/admin/skills/[id]/archive`
- `POST /api/admin/skills/[id]/duplicate`

All admin endpoints should use `requireAdmin()`.

### User-facing APIs

Keep:

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/skills`
- `POST /api/skills`

Extend response shapes so the UI can render clearer buckets.

Recommended shape for agents:

```ts
type AgentsResponse = {
  mine: Agent[];
  essentials: Agent[];
  shared: Agent[];
};
```

Recommended shape for skills:

```ts
type SkillsResponse = {
  mine: Skill[];
  essentials: Skill[];
  community: Skill[];
};
```

This is a cleaner long-term contract than the current mixed arrays.

### Clone/use APIs

Keep the existing agent copy route:

- `POST /api/agents/templates/[id]/use`

Add the skill equivalent:

- `POST /api/skills/templates/[id]/use`

Both routes should:

- verify the template is published and user-visible
- clone the source row
- set `templateId`
- set `sourceTemplateVersion`
- set `isTemplate = false`
- set `catalogScope = personal`
- clear admin-only publish metadata on the new copy

---

## Publishing Rules

An admin template should move through this lifecycle:

### Draft

- visible in admin only
- editable
- not shown in user catalog

### Published

- visible in admin
- visible in user essentials catalog
- usable or duplicable by users

### Archived

- no longer shown in user essentials
- still visible in admin history
- existing user copies continue to work

Recommended implementation:

- do not hard-delete published templates
- use `catalogStatus` and `archivedAt`

---

## Update Semantics

When an admin updates a published template:

- increment `version`
- store optional `changelog`
- update `updatedAt`

### Locked-use items

If `cloneBehavior = locked` and `updatePolicy = auto_for_locked`:

- users who launch the template directly always get the latest published version

This is safe because there is no editable copy in the middle.

### Editable copies

If a user cloned version `2` and the source is now version `3`:

- show `Update available`
- do not auto-overwrite the user's copy

Update availability can be derived from:

- `templateId`
- `sourceTemplateVersion`
- source template `version`

Recommended v1 behavior:

- only show a banner and badge
- do not attempt field-level merges yet

---

## Locked Fields

Some template properties should be lockable so admins can protect the essential behavior.

Recommended lockable fields for agents:

- `systemPrompt`
- `enabledTools`
- `modelId`
- `brandId`
- `documentIds`
- `starterPrompts`

Recommended lockable fields for skills:

- `promptFragment`
- `triggerType`
- `trigger`
- `activationMode`
- `enabledTools`
- `files`

Implementation note:

- `lockedFields` should control editor affordances first
- server-side validation should enforce locks for cloned-but-managed scenarios if that mode is introduced later

For v1, most editable copies can simply become fully user-owned after cloning, so lock enforcement is mainly relevant to direct locked-use templates and future managed-copy modes.

---

## UI Changes

### User-facing agents page

Current screen already separates `My Agents` and `Templates`.

Change to:

- `Essentials`
- `Mine`
- `Shared`

Card badges:

- `Official`
- `Admin managed`
- `Locked`
- `Update available`
- `Default`

Primary actions:

- `Use now`
- `Customize`
- `Duplicate`

### User-facing skills page

Current screen separates `My skills` and `Community`.

Change to:

- `Essential skills`
- `My skills`
- `Community`

Card badges:

- `Official`
- `Package`
- `Always`
- `Keyword: ...`
- `Update available`

Primary actions:

- `Use`
- `Customize`
- `Install`

Use `Install` for community items and `Use` or `Customize` for official essentials to keep the meaning clear.

### Admin pages

Add:

- `app/admin/agents/page.tsx`
- `app/admin/skills/page.tsx`

Admin list views should support:

- status filter
- search
- duplicate
- publish
- archive
- preview
- usage count

Admin editor views should support:

- core info
- system prompt or prompt fragment
- tool permissions
- image
- lock settings
- publish settings
- changelog

---

## Query And Hook Changes

Update:

- [features/agents/hooks/use-agents.ts](/d:/vscode2/nextjs/ai-sdk/features/agents/hooks/use-agents.ts)
- [features/skills/hooks/use-skills.ts](/d:/vscode2/nextjs/ai-sdk/features/skills/hooks/use-skills.ts)

Recommended client hooks:

- `useAgents()` returns `{ mine, essentials, shared }`
- `useSkills()` returns `{ mine, essentials, community }`
- `useUseAgentTemplate()`
- `useUseSkillTemplate()`
- `useAdminAgents()`
- `useAdminSkills()`

Keep the copy action explicit in hook naming.

That helps avoid confusing `template use` with `community install`.

---

## Chat Runtime Impact

This feature should not require large changes to the core chat pipeline.

Important compatibility rules:

- copied agents still behave like normal user agents
- copied skills still behave like normal user skills
- existing skill attachment logic remains valid
- existing template-based agent usage remains valid

The most important chat-adjacent rule is:

- a user should only attach or run items they can see from the published catalog or from their personal library

No new prompt-injection behavior is required for this feature itself.

---

## Migration Plan

### Migration 1

Extend `agent` metadata:

- add catalog lifecycle and versioning fields

### Migration 2

Extend `agent_skill` metadata:

- make `user_id` nullable
- add template and catalog lifecycle fields

### Migration 3

Backfill current records:

- system agent templates become:
  - `catalogScope = system`
  - `catalogStatus = published`
  - `managedByAdmin = true`
  - `version = 1`

- user agents become:
  - `catalogScope = personal`
  - `catalogStatus = draft`

- public/community skills remain:
  - `catalogScope = personal`
  - `isPublic = true`

No skill should automatically become an official essential during migration.

That should be an explicit admin action later.

---

## Recommended File Map

### New files

- `docs/admin-managed-agents-skills-implementation.md`
- `features/agents/server/catalog.ts`
- `features/skills/server/catalog.ts`
- `app/api/admin/agents/route.ts`
- `app/api/admin/agents/[id]/route.ts`
- `app/api/admin/agents/[id]/publish/route.ts`
- `app/api/admin/agents/[id]/archive/route.ts`
- `app/api/admin/skills/route.ts`
- `app/api/admin/skills/[id]/route.ts`
- `app/api/admin/skills/[id]/publish/route.ts`
- `app/api/admin/skills/[id]/archive/route.ts`
- `app/api/skills/templates/[id]/use/route.ts`
- `app/admin/agents/page.tsx`
- `app/admin/skills/page.tsx`

### Existing files to update

- `db/schema/agents.ts`
- `db/schema/skills.ts`
- `features/agents/types.ts`
- `features/skills/types.ts`
- `features/agents/hooks/use-agents.ts`
- `features/skills/hooks/use-skills.ts`
- `app/api/agents/route.ts`
- `app/api/skills/route.ts`
- `app/admin/layout.tsx`

---

## Phase Plan

### Phase 1: Data model and service layer

Deliver:

- schema updates
- migrations
- catalog service modules
- publish/archive behavior
- skill template clone route

Acceptance criteria:

- admins can create draft templates
- admins can publish and archive
- users can clone published templates

### Phase 2: Admin UI

Deliver:

- admin agents page
- admin skills page
- template editor forms
- publish/archive controls

Acceptance criteria:

- internal admins can manage the official catalog without direct DB edits

### Phase 3: User catalog UX

Deliver:

- updated agents tabs
- updated skills tabs
- official badges
- update-available badge

Acceptance criteria:

- users can clearly tell which items are official essentials
- users can use or customize them in one click

### Phase 4: Version visibility

Deliver:

- version metadata in list/detail payloads
- update available banner on user copies
- optional changelog modal

Acceptance criteria:

- users can tell when their copy is behind the source template

---

## Testing Guidance

Minimum recommended coverage:

### Unit tests

- catalog state transitions
- publish validation
- archive behavior
- clone behavior for agents
- clone behavior for skills
- version comparison logic

### Integration tests

- non-admin blocked from admin routes
- published essentials returned to signed-in users
- draft essentials hidden from users
- user clone receives correct `templateId` and `sourceTemplateVersion`
- archived templates stop appearing in essentials lists

### UI tests

- essentials tab renders official items
- badges render correctly
- `Use` creates a personal copy when required
- update available badge appears for outdated copies

---

## Non-Goals

This proposal intentionally does not solve:

- workspace/team template targeting
- managed shared copies with field-level merge
- cross-org permissions
- billing changes tied to template ownership
- automated migration of community skills into official skills

Those should be designed after the internal admin catalog is proven useful.

---

## Recommended First Slice

If implementation needs to stay especially tight, ship this order:

1. extend skill schema to support official templates
2. add admin CRUD and publish/archive for skills
3. add admin CRUD and publish/archive for agents
4. add user-facing `Essentials` tabs and clone flows
5. add update-available badges

This order closes the largest product gap first, because agents already have partial template behavior and skills do not.

---

## Final Guidance

The right mental model for this feature is:

- admins publish the best starting point
- users keep control of their own working copies

That gives Vaja the ready-to-use experience the product needs without creating brittle admin-overwrites-user behavior.

If future contributors need a tie-breaker between convenience and safety, choose the safer rule:

- official templates should be easy to start from
- user-owned work should stay stable unless the user explicitly adopts an update
