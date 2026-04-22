# Agent Brand Mode Implementation Plan

> Audience: developers implementing the first concrete step of agent context governance.
> Purpose: define the exact implementation plan for introducing agent brand modes and brand access policy without attempting the full generalized context system yet.

---

## Status

Current implementation progress:

- `PR 1 - Schema and types`: completed in code
- `PR 2 - User and admin API support`: completed in code
- `PR 3 - User-facing agent editor`: completed in code
- `PR 4 - Admin template catalog support`: completed in code
- `PR 5 - Runtime resolution in chat`: completed in code
- `PR 6 - Cleanup and follow-through`: completed in code

Current shipped code changes include:

- new `agent` fields in schema:
  - `brandMode`
  - `brandAccessPolicy`
  - `requiresBrandForRun`
  - `fallbackBehavior`
- shared TS types for brand-mode behavior
- shared normalization helper:
  - `features/agents/server/brand-config.ts`
- user create/update API support
- admin template create/update support
- user agent form support for brand mode, access policy, fallback behavior, and require-brand toggle
- admin lockable field support for the new brand-governance fields

Migration note:

- the generated Drizzle migration was cleaned up because it bundled unrelated `image_model_config` drift
- the canonical migration for this change is:
  - `db/migrations/0056_agent_brand_mode.sql`

Current scope status:

- this implementation plan is complete for the scoped brand-governance slice
- any future work to generalize beyond `brand` into broader organization or workspace context should be treated as a new phase, not as unfinished work from this plan

PR 5 progress now includes:

- canonical runtime resolver:
  - `features/agents/server/brand-resolution.ts`
- chat route integration:
  - `app/api/chat/route.ts`
- preview route integration:
  - `app/api/agents/[id]/preview-prompt/route.ts`
- team chat integration:
  - `app/api/team-chat/route.ts`
  - `app/api/team-chat/plan/route.ts`
  - `features/agent-teams/server/brand-context.ts`
- public shared-agent chat integration:
  - `app/api/agent/[token]/chat/route.ts`
- agent editor preview payload support:
  - `features/agents/components/agent-form.tsx`
  - `features/agents/components/agent-prompt-preview-section.tsx`
- support for:
  - `none`
  - `optional`
  - `suggested`
  - `locked`
  - `use_default`
  - `ask_to_select`
  - `block_run`

PR 5 completion note:

- `brandAccessPolicy` now enforces `no_brand`, `specific_brand`, and `workspace_only` using the current brand/share/workspace-member model
- main chat, prompt preview, team-chat, and public shared-agent chat now share the same brand resolution rules

PR 6 progress now includes:

- dedicated resolver tests:
  - `features/agents/server/brand-resolution.test.ts`
- dedicated normalization tests:
  - `features/agents/server/brand-config.test.ts`
- testable lazy dependency loading in the resolver to avoid requiring a live database during unit tests
- package test script updated to include agent server tests
- docs updated to reflect implementation progress and final scope completion

PR 4 completion now includes:

- admin editor brand selection enabled:
  - `app/admin/agents/page.tsx`
- cloned published templates now preserve template brand governance config:
  - `features/agents/server/catalog.ts`
- behavior editor can display an inaccessible bound brand safely:
  - `features/agents/components/agent-behavior-section.tsx`

---

## 1. Goal

Ship the first production-grade version of agent brand governance by:

1. Keeping `brand` as the canonical brand source.
2. Extending `agent` with explicit brand behavior fields.
3. Replacing the current implicit "brand if `brandId` exists" behavior with clear runtime rules.
4. Updating the agent editor so users and admins can intentionally choose how an agent uses brand context.

This is the smallest implementation that materially improves:

- admin-managed shared agents
- workspace-shared agents
- general reusable agents
- brand-specific official agents

Without blocking on the broader future `workspace context` system.

---

## 2. Scope

### In scope

- database schema updates on `agent`
- TypeScript type updates
- user and admin agent API updates
- agent editor UI updates
- runtime brand resolution helper
- chat route integration
- template and clone behavior alignment
- basic backward compatibility for existing `agent.brandId`

### Out of scope

- replacing `brand` with a fully generic context model
- removing `brand_profile`
- migrating all brand setup UX
- redesigning all workspace ownership and organization tables
- non-brand context types like `school`, `farm`, or `clinic`

Those belong to later phases.

---

## 3. Target Product Behavior

### New agent brand modes

Add four explicit modes:

- `none`
- `optional`
- `suggested`
- `locked`

### Brand access policy

Add explicit brand access rules:

- `no_brand`
- `any_accessible`
- `workspace_only`
- `specific_brand`

### Runtime behavior

#### `none`

- The agent never uses brand context.
- Ignore user-selected active brand.
- Ignore `brandId`.

#### `optional`

- Use the user's active accessible brand if one is selected.
- If none is selected, continue without brand.

#### `suggested`

- Prefer the agent's `brandId` when accessible.
- Allow override to another accessible brand.
- If no override and no valid bound brand, fall back according to policy.

#### `locked`

- Always use the agent's `brandId`.
- User cannot override.
- If the brand is inaccessible or missing, follow `fallbackBehavior`.

### Fallback behavior

Add:

- `ask_or_continue`
- `ask_to_select`
- `block_run`
- `use_default`

These control what happens when a mode requires or expects brand context but no valid brand is available.

---

## 4. Data Model Changes

## 4.1 Schema changes

Update `db/schema/agents.ts`.

Add:

```ts
brandMode: text("brand_mode").notNull().default("optional"),
brandAccessPolicy: text("brand_access_policy").notNull().default("any_accessible"),
requiresBrandForRun: boolean("requires_brand_for_run").notNull().default(false),
fallbackBehavior: text("fallback_behavior").notNull().default("ask_or_continue"),
```

Keep:

```ts
brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
```

### Why keep `brandId`

`brandId` remains the actual bound brand record.

The new fields only define behavior:

- whether the agent uses brand at all
- whether users may override it
- whether the bound brand is required

### Suggested enums

No hard DB enum is required yet. Use validated `text` columns first for faster iteration.

Expected values:

```ts
type BrandMode = 'none' | 'optional' | 'suggested' | 'locked';
type BrandAccessPolicy = 'no_brand' | 'any_accessible' | 'workspace_only' | 'specific_brand';
type FallbackBehavior = 'ask_or_continue' | 'ask_to_select' | 'block_run' | 'use_default';
```

---

## 4.2 Backward compatibility rules

Existing agents need safe defaults.

### Migration interpretation

For existing rows:

- if `brandId IS NULL`
  - `brandMode = 'optional'`
  - `brandAccessPolicy = 'any_accessible'`
  - `requiresBrandForRun = false`
  - `fallbackBehavior = 'ask_or_continue'`

- if `brandId IS NOT NULL`
  - `brandMode = 'locked'`
  - `brandAccessPolicy = 'specific_brand'`
  - `requiresBrandForRun = true`
  - `fallbackBehavior = 'block_run'`

This preserves current behavior as closely as possible.

### Alternative softer default

If you want less disruption for existing agents with `brandId`, use:

- `brandMode = 'suggested'`
- `brandAccessPolicy = 'specific_brand'`
- `requiresBrandForRun = false`
- `fallbackBehavior = 'ask_or_continue'`

Recommendation:

- use the stricter locked mapping for system/admin templates
- use the softer suggested mapping for user-created agents if you can distinguish them safely

---

## 5. Type Updates

Update `features/agents/types.ts`.

Add:

```ts
export type BrandMode = 'none' | 'optional' | 'suggested' | 'locked';
export type BrandAccessPolicy = 'no_brand' | 'any_accessible' | 'workspace_only' | 'specific_brand';
export type FallbackBehavior = 'ask_or_continue' | 'ask_to_select' | 'block_run' | 'use_default';
```

Add to `Agent`:

```ts
brandMode: BrandMode;
brandAccessPolicy: BrandAccessPolicy;
requiresBrandForRun: boolean;
fallbackBehavior: FallbackBehavior;
```

Add to `CreateAgentInput`:

```ts
brandMode?: BrandMode;
brandAccessPolicy?: BrandAccessPolicy;
requiresBrandForRun?: boolean;
fallbackBehavior?: FallbackBehavior;
```

Update `UpdateAgentInput` accordingly.

---

## 6. API Changes

## 6.1 User agent APIs

Update:

- `app/api/agents/route.ts`
- `app/api/agents/[id]/route.ts`

### Validation changes

Add to create/update schemas:

```ts
brandMode: z.enum(['none', 'optional', 'suggested', 'locked']).optional(),
brandAccessPolicy: z.enum(['no_brand', 'any_accessible', 'workspace_only', 'specific_brand']).optional(),
requiresBrandForRun: z.boolean().optional(),
fallbackBehavior: z.enum(['ask_or_continue', 'ask_to_select', 'block_run', 'use_default']).optional(),
```

### Create defaults

On create:

- if user explicitly chooses `none`, set `brandId = null`
- otherwise allow `brandId`
- apply default values if fields are omitted

### Update behavior

On update:

- allow brand behavior fields to be changed
- validate consistency:
  - if `brandMode = 'none'`, clear `brandId`
  - if `brandAccessPolicy = 'no_brand'`, enforce `brandMode = 'none'`
  - if `brandMode = 'locked'` and `brandId` is missing, reject request
  - if `brandAccessPolicy = 'specific_brand'` and `brandId` is missing, reject request

### Suggested server-side normalization helper

Create a helper such as:

```ts
normalizeAgentBrandConfig(input)
```

Use it in both create and update routes to prevent duplicated validation logic.

---

## 6.2 Admin agent APIs

Update:

- `app/api/admin/agents/route.ts`
- `app/api/admin/agents/[id]/route.ts`
- `features/agents/server/catalog.ts`

### Required admin support

Admin templates should support:

- `brandMode`
- `brandAccessPolicy`
- `requiresBrandForRun`
- `fallbackBehavior`
- `brandId`

### Recommendation for template cloning

When cloning admin templates:

- `locked` brand mode stays locked only if user has access to that brand
- otherwise block clone or require selecting a valid brand

For now, a simpler first step is acceptable:

- keep template brand config as metadata
- only enforce at runtime when used

---

## 7. Runtime Brand Resolution

## 7.1 New service helper

Add a canonical helper in the brand or agent service layer.

Recommended file:

- `features/brands/service.ts`
  or
- `features/agents/server/brand-resolution.ts`

Recommendation:

- create `features/agents/server/brand-resolution.ts` to keep resolution logic isolated and testable

### Suggested API

```ts
type ResolveEffectiveBrandInput = {
  userId: string;
  activeBrandId?: string | null;
  agent: {
    brandId: string | null;
    brandMode: BrandMode;
    brandAccessPolicy: BrandAccessPolicy;
    requiresBrandForRun: boolean;
    fallbackBehavior: FallbackBehavior;
  } | null;
};

type ResolveEffectiveBrandResult = {
  effectiveBrandId: string | null;
  mode: BrandMode;
  canOverride: boolean;
  reason:
    | 'agent_none'
    | 'used_active_brand'
    | 'used_agent_brand'
    | 'used_default_brand'
    | 'no_brand'
    | 'blocked_missing_required_brand';
  shouldBlock: boolean;
  blockMessage?: string;
};
```

### Rules

#### If no agent

- use current behavior:
  - active selected brand if available
  - else none

#### If `brandMode = none`

- return `effectiveBrandId = null`
- ignore active brand and agent `brandId`

#### If `brandMode = optional`

- use active brand if accessible
- else no brand

#### If `brandMode = suggested`

- use active brand if user selected one and it is accessible
- else use agent `brandId` if accessible
- else optional fallback behavior

#### If `brandMode = locked`

- use agent `brandId` only
- do not allow override
- if inaccessible or missing:
  - block, ask, or default based on `fallbackBehavior`

### Accessibility checks

Use the same brand access rules already present in chat:

- owner brand
- shared brand
- later workspace brand logic if needed

---

## 7.2 Chat route integration

Update `app/api/chat/route.ts`.

### Current behavior

Current brand resolution is:

```ts
const effectiveBrandId = (!isGuest && (activeAgent?.brandId ?? brandId)) || null;
```

### Replace with

Use the new resolution helper:

```ts
const brandResolution = await resolveEffectiveBrand(...);
const effectiveBrandId = brandResolution.effectiveBrandId;
```

### Additional runtime behavior

If `brandResolution.shouldBlock`:

- return a user-facing assistant message or API error depending on chosen UX

Recommendation for first version:

- do not return a hard HTTP error
- instead inject a short assistant/system constraint telling the model to ask the user to choose a brand

Later you can formalize this into a structured preflight response.

---

## 7.3 Other routes that should eventually reuse the helper

After chat is done, apply the same resolution helper to:

- `app/api/team-chat/route.ts`
- `app/api/team-chat/plan/route.ts`
- image generation flows if agent-specific brand behavior matters there
- future agent preview prompt generation if you want preview fidelity

For the first implementation, chat route is the critical path.

---

## 8. UI Changes

## 8.1 User agent editor

Update:

- `features/agents/components/agent-form.tsx`
- `features/agents/components/agent-behavior-section.tsx`

### Replace current Brand selector block

Current UI:

- one Brand dropdown
- copy: "Brand context is automatically injected"

### New UI

Add a `Brand Mode` section above the specific brand picker.

Recommended controls:

1. `Brand mode`
   - No brand
   - Use selected brand
   - Prefer this brand
   - Lock to this brand

2. `Brand`
   - shown only for `suggested` and `locked`

3. `If brand is unavailable`
   - Ask and continue
   - Ask user to select
   - Block run
   - Use default brand

4. `Brand is required to run`
   - checkbox

### UI logic

- if `brandMode = none`
  - hide brand picker
- if `brandMode = optional`
  - hide brand picker unless you want "suggest a default" later
- if `brandMode = suggested` or `locked`
  - show brand picker
- if `brandMode = locked`
  - show helper copy that users cannot override this brand in chat

### Suggested copy

Label:

- `Brand mode`

Helper text:

- `Choose whether this agent ignores brand, uses the currently selected brand, suggests one brand, or stays locked to one brand.`

---

## 8.2 Admin template editor

Update:

- `features/agents/components/admin-agent-catalog-section.tsx`
- `app/admin/agents/page.tsx`

### Add brand governance controls

Recommended additions:

- `Brand mode`
- `Default/locked brand`
- `Fallback behavior`
- `Requires brand to run`

### Locked fields support

Add the new fields to admin lockable fields list:

- `brandMode`
- `brandAccessPolicy`
- `requiresBrandForRun`
- `fallbackBehavior`

Consider whether `brandId` should remain independently lockable or whether locking `brandMode` + `brandId` together is enough.

Recommendation:

- keep `brandId` lockable separately for now

---

## 9. File-Level Work Breakdown

### Database

- `db/schema/agents.ts`
- migration file generated by Drizzle

### Shared types

- `features/agents/types.ts`

### User APIs

- `app/api/agents/route.ts`
- `app/api/agents/[id]/route.ts`

### Admin APIs

- `app/api/admin/agents/route.ts`
- `app/api/admin/agents/[id]/route.ts`
- `features/agents/server/catalog.ts`

### Runtime

- `features/agents/server/brand-resolution.ts` new
- `app/api/chat/route.ts`

### UI

- `features/agents/components/agent-form.tsx`
- `features/agents/components/agent-behavior-section.tsx`
- `features/agents/components/admin-agent-catalog-section.tsx`
- `app/admin/agents/page.tsx`

### Optional preview support

- `app/api/agents/[id]/preview-prompt/route.ts`

---

## 10. PR Plan

Ship this in small PRs.

## PR 1 - Schema and types

Changes:

- add agent schema fields
- update TS types
- generate migration

Deliverable:

- project compiles with new agent fields available

## PR 2 - User and admin API support

Changes:

- update create/update validation
- add normalization helper
- persist new fields through APIs

Deliverable:

- agents can be created and updated with brand mode metadata

## PR 3 - User-facing agent editor

Changes:

- add `Brand mode` UI
- conditionally show brand picker
- wire new fields through form submit

Deliverable:

- normal users can configure brand behavior intentionally

## PR 4 - Admin template catalog support

Changes:

- expose brand mode controls in admin agent page
- add new lockable fields

Deliverable:

- admin templates can publish official brand-aware or brand-locked agents

## PR 5 - Runtime resolution in chat

Changes:

- add brand resolution helper
- replace current inline `activeAgent?.brandId ?? brandId` logic

Deliverable:

- runtime behavior now matches the configured agent brand mode

## PR 6 - Cleanup and follow-through

Changes:

- update prompt preview route if needed
- add tests
- update docs

Deliverable:

- feature is production-ready and documented

---

## 11. Testing Plan

## 11.1 Unit tests

Add tests for brand resolution helper:

- no agent + active brand
- `none`
- `optional` with active brand
- `optional` without active brand
- `suggested` with active override
- `suggested` without active override
- `locked` with valid brand
- `locked` without brand
- `locked` with inaccessible brand
- each fallback behavior

## 11.2 API tests

Validate:

- create agent with each brand mode
- update agent brand mode
- invalid combinations are rejected

Example invalid cases:

- `locked` without `brandId`
- `specific_brand` without `brandId`
- `no_brand` with `brandMode != none`

## 11.3 Manual QA

Test these scenarios:

1. Personal general agent
   - `brandMode = none`
   - active brand selected in sidebar
   - agent should ignore brand

2. Reusable marketing agent
   - `brandMode = optional`
   - selected brand in sidebar
   - agent should use selected brand

3. Suggested brand template
   - `brandMode = suggested`
   - brand set on agent
   - user should be able to override with another accessible brand

4. Locked official agent
   - `brandMode = locked`
   - brand set on agent
   - user should not be able to override

5. Shared user without brand access
   - shared agent references private brand
   - fallback behavior should apply correctly

---

## 12. Rollout Strategy

### Safe rollout

Use a backward-compatible rollout.

Step 1:

- deploy schema and API support first
- do not switch runtime yet

Step 2:

- deploy UI to start writing valid new config

Step 3:

- switch chat route to new helper

### Why this order

It avoids:

- runtime reading fields that old agents do not yet have
- UI exposing fields before APIs can save them
- chat route behavior changing before editors can explain it

---

## 13. Risks And Mitigations

### Risk 1: shared agents point to inaccessible brands

Mitigation:

- enforce access checks in resolution helper
- surface user-friendly fallback behavior

### Risk 2: admin templates become too rigid

Mitigation:

- default admin templates to `suggested`, not `locked`, unless truly official

### Risk 3: runtime and preview diverge

Mitigation:

- eventually reuse the same resolution helper in preview route

### Risk 4: confusing UX around active brand vs agent brand

Mitigation:

- explicit labels:
  - `Use selected brand`
  - `Prefer this brand`
  - `Lock to this brand`

### Risk 5: later generic context work invalidates this effort

Mitigation:

- keep this implementation as a brand-specific subset of future context governance
- do not over-abstract yet

---

## 14. Acceptance Criteria

This implementation is complete when:

1. Agents can be saved with explicit brand behavior fields.
2. The agent editor exposes clear brand modes.
3. Admin templates can configure and lock brand behavior fields.
4. Chat runtime resolves effective brand via shared helper logic.
5. Existing agents continue to work after migration.
6. Shared agents no longer rely on implicit `brandId` behavior only.

Acceptance status:

- all acceptance criteria above are now met in code for this scoped implementation

---

## 15. Recommended First Task

Begin with **PR 1 + PR 2**:

- add schema fields
- add TS types
- update create/update APIs
- add normalization helper

This gives a stable contract for both UI and runtime, and it is the best first implementation step.
