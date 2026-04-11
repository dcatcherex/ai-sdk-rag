# Admin Implementation Guide

## Purpose

This document explains how the internal admin area in Vaja is structured today and how future contributors should maintain or extend it safely.

It is intended for:

- AI coding agents working in this repo
- developers adding admin screens or reports
- maintainers debugging admin-only issues later

This guide describes the current implementation in:

- `app/admin/`
- `app/api/admin/`
- `lib/admin.ts`

and the supporting data sources used by the admin console.

---

## Scope

The current admin area is an **internal operator console**.

It is not yet the same thing as:

- a workspace owner dashboard
- a brand admin dashboard
- an organization credit pool console
- a customer-facing backoffice

Current admin access is controlled by `ADMIN_EMAILS` in environment variables and enforced by `requireAdmin()` in `lib/admin.ts`.

Important rule:

- treat `app/admin` and `app/api/admin` as internal-only surfaces unless the access model is intentionally redesigned

---

## Current Progress

Implemented now:

- admin layout shell and navigation in `app/admin/layout.tsx`
- admin dashboard in `app/admin/page.tsx`
- user management page in `app/admin/users/page.tsx`
- admin-managed invite flow in `app/admin/users/page.tsx`
- public invite landing page in `app/invite/[token]/page.tsx`
- credit transaction page in `app/admin/credits/page.tsx`
- AI observability page in `app/admin/chat-runs/page.tsx`
- admin APIs for:
  - users
  - admin user invites
  - credit transactions
  - chat runs
  - workspace AI runs
  - tool runs
  - unified AI runs
  - AI trends
- centralized admin auth helper in `lib/admin.ts`

Not implemented yet:

- role-based admin permissions beyond email allowlist
- a separate admin service/query layer
- CSV/export support
- chart visualizations
- a customer-facing group admin console
- organization/team credit pools inside the admin surface

---

## Admin Surface Map

### UI routes

Current pages:

- `app/admin/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/credits/page.tsx`
- `app/admin/chat-runs/page.tsx`

Current layout shell:

- `app/admin/layout.tsx`

Navigation labels today:

- `Dashboard`
- `Users`
- `Credits`
- `AI Runs`

### API routes

Current admin APIs:

- `GET /api/admin/users`
- `PATCH /api/admin/users`
- `GET /api/admin/credits/transactions`
- `GET /api/admin/chat-runs`
- `GET /api/admin/chat-runs/[runId]`
- `GET /api/admin/workspace-ai-runs`
- `GET /api/admin/workspace-ai-runs/[runId]`
- `GET /api/admin/tool-runs`
- `GET /api/admin/tool-runs/[runId]`
- `GET /api/admin/ai-runs`
- `GET /api/admin/ai-runs/trends`

Historical exception:

- credit grants are currently executed through `POST /api/credits/grant`
- this route is still admin-gated via `requireAdmin()`
- it is not namespaced under `/api/admin`

When extending the system:

- prefer new admin-only endpoints under `app/api/admin/`
- only keep non-admin route placement when there is a strong compatibility reason

---

## Access Control

### Canonical guard

Admin access is enforced through:

- `lib/admin.ts`

Current behavior:

- fetch session via Better Auth
- reject unauthenticated users with `401`
- reject non-admin users with `403`
- determine admin status from `process.env.ADMIN_EMAILS`

Important rules:

- every admin API route must call `requireAdmin()`
- do not duplicate admin email parsing in route files
- do not rely only on the client-side check in `app/admin/layout.tsx`
- the layout check is UX only, not the real security boundary

### Client-side access check

`app/admin/layout.tsx` currently verifies access by requesting:

- `GET /api/admin/users?limit=1`

If the request fails:

- the user is redirected to `/`

This is acceptable as a lightweight gate for the current internal console, but remember:

- server routes remain the real source of truth

---

## Data Sources

The admin console currently reads from several different ledgers.

### Users and approval

Primary tables:

- `user` in `db/schema/auth.ts`
- `user_credit` in `db/schema/credits.ts`

Current auth and onboarding behavior:

- Better Auth is configured in `lib/auth.ts`
- email verification is enabled
- email/password auth is enabled
- magic link sign-in is enabled
- Google OAuth is optional
- new users may be marked `approved = false` when `REQUIRE_APPROVAL` is enabled
- signup bonus credits are granted in the auth hook after user creation

Admin user management currently covers:

- user listing
- search
- pending approval filter
- approve / revoke approval
- current credit balance display
- invite creation
- invite resend
- invite cancellation
- invite status display
- invite audit context for lifecycle timestamps and accepting account details

Admin user management still does not currently cover:

- creating an active password-based account directly from admin
- bulk user invite import
- workspace or organization membership provisioning during invite

### Credit ledger

Primary tables:

- `user_credit` in `db/schema/credits.ts`
- `credit_transaction` in `db/schema/credits.ts`

Admin credit reporting currently covers:

- transaction history
- transaction type filtering
- transaction amounts and post-transaction balances

### AI observability

Primary ledgers:

- `chat_run` in `db/schema/chat.ts`
- `workspace_ai_run` in `db/schema/tools.ts`
- `tool_run` in `db/schema/tools.ts`

These ledgers intentionally stay separate because they represent different runtime classes.

Important rule:

- do not collapse these ledgers into one database table just because the admin UI displays them together

The unified admin timeline is a reporting layer built on top of separate ledgers, not a shared persistence model.

---

## Page Responsibilities

### `app/admin/layout.tsx`

Responsibilities:

- render admin navigation shell
- run lightweight client-side access check
- keep desktop/mobile admin navigation consistent

Should not own:

- business logic
- database reads
- report aggregation

### `app/admin/page.tsx`

Responsibilities:

- show a compact operator overview
- fetch a few recent users, transactions, and AI runs
- provide quick links into deeper admin pages

Important note:

- dashboard cards are summaries only
- deeper pages and APIs should be treated as the authoritative detail views

### `app/admin/users/page.tsx`

Responsibilities:

- list users
- search users
- filter pending approvals
- approve / revoke access
- grant credits manually
- create admin invites
- list invite history
- resend active invites
- cancel active invites

Important note:

- manual credit grant currently posts to `/api/credits/grant`
- that is an admin-only operational action, not a self-service user flow
- this page now combines existing-user operations with admin onboarding via invite
- invites are shown in a separate table so invite lifecycle state stays distinct from user-account state

### `app/admin/credits/page.tsx`

Responsibilities:

- list credit ledger entries
- filter by transaction type
- browse recent pages

### `app/admin/chat-runs/page.tsx`

Responsibilities:

- show date-range filtering shared across AI runtime reports
- report chat runs
- report workspace AI runs
- report tool runs
- report unified cross-runtime activity
- show trend summaries
- open detail dialogs for individual runs

This is currently the deepest admin page in the console.

---

## API Responsibilities

### `app/api/admin/users/route.ts`

Responsibilities:

- list users with balances
- filter users by search and approval status
- update `user.approved`

Important rule:

- keep this route focused on admin user access/state
- do not move general end-user profile editing into this route

If admin-managed onboarding is added later, prefer adding a separate route such as:

- `POST /api/admin/users/invite`

instead of overloading the current list/update route with unrelated account provisioning behavior

Admin-managed invite routes now implemented:

- `GET /api/admin/users/invite`
- `POST /api/admin/users/invite`
- `POST /api/admin/users/invite/[inviteId]/resend`
- `POST /api/admin/users/invite/[inviteId]/cancel`
- `POST /api/invite/[token]/claim`

Important note:

- the claim route intentionally lives outside `/api/admin`
- claiming an invite is performed by the invited user after authentication, not by an admin

### `app/api/admin/credits/transactions/route.ts`

Responsibilities:

- return credit transaction history for admin reporting

Important rule:

- this route is reporting-oriented
- mutation of balances should continue going through credit service helpers and dedicated mutation routes

### `app/api/admin/chat-runs/*`

Responsibilities:

- expose admin views over `chat_run`
- provide filtered lists and per-run detail

### `app/api/admin/workspace-ai-runs/*`

Responsibilities:

- expose admin views over `workspace_ai_run`

### `app/api/admin/tool-runs/*`

Responsibilities:

- expose admin views over `tool_run`

### `app/api/admin/ai-runs/route.ts`

Responsibilities:

- merge multiple runtime ledgers into one reporting response

Important rule:

- this route is a read-model layer
- keep runtime-specific logic in the runtime-specific ledgers and queries

### `app/api/admin/ai-runs/trends/route.ts`

Responsibilities:

- aggregate daily AI activity across runtimes
- summarize run count, error count, token usage, and credit usage

Important rule:

- if trend metrics expand later, extend the aggregation carefully
- avoid duplicating dashboard math in the UI

---

## Current Architectural Pattern

The admin area currently follows this pattern:

```text
Admin page
  -> fetch('/api/admin/...')
  -> route validates admin session
  -> route reads directly from DB
  -> route returns reporting JSON
  -> page renders tables/cards/dialogs
```

This is acceptable for the current internal console because:

- the number of admin pages is still small
- each page is tightly coupled to one reporting use case
- the routes are read-heavy and operational

However, this also means:

- query logic is distributed across route files
- there is no shared admin query module yet

If the admin surface grows substantially, a future refactor should introduce:

```text
features/admin/
  queries/
  schema/
  types/
```

Do not create that abstraction prematurely unless the admin surface becomes meaningfully larger.

---

## Recommended Admin-Managed User Onboarding

Admin-managed onboarding is a reasonable future addition for Vaja, especially for:

- pilot groups
- internal operators onboarding first users
- small teams where one owner wants to add members directly

However, the recommended design is:

- **admin invite / provisioning**

not:

- **admin manually creates a full password-based account for the user**

### Why invite/provisioning is the preferred model

The current auth system is already built around:

- verified email ownership
- magic link login
- optional OAuth

That means the safest and lowest-friction admin flow is:

1. admin enters `name` and `email`
2. system creates an invite or pre-provisioned pending identity
3. system sends a magic-link or invite email
4. user completes first sign-in and confirms ownership of the email
5. account becomes usable with the intended approval state

This approach fits the current auth architecture better than raw password assignment.

### Why not admin-created password accounts

Avoid a design where the admin:

- chooses a password for the user
- creates an active account without email ownership proof
- bypasses verification entirely for normal users

Reasons:

- it increases security risk
- it adds support burden around password resets and first-login confusion
- it works against the existing Better Auth and magic-link model
- it creates a second onboarding system to maintain

### Recommended v1 admin onboarding shape

Implemented v1 behavior now supports:

- invite by email
- optional display name
- optional auto-approval
- optional starting credits
- visible invite status in admin UI

Good statuses would be:

- `invited`
- `accepted`
- `expired`
- `cancelled`

### Recommended route split

Keep responsibilities clear:

- `GET /api/admin/users`
- `PATCH /api/admin/users`

and add separate onboarding routes if needed:

- `POST /api/admin/users/invite`
- `POST /api/admin/users/invite/[inviteId]/resend`
- `POST /api/admin/users/invite/[inviteId]/cancel`

Do not mix all of that into one broad users mutation endpoint.

### Recommended persistence model

Do not force invite state into the existing `user` table alone.

If invite/provisioning is added, introduce a dedicated persistence contract such as:

- `admin_user_invite`

Possible fields:

- `id`
- `email`
- `name`
- `status`
- `invited_by_user_id`
- `approved_on_accept`
- `initial_credit_grant`
- `expires_at`
- `accepted_at`
- `accepted_user_id`
- `created_at`

This keeps:

- account identity
- approval state
- invite lifecycle

separate and easier to maintain.

### Recommended UI placement

If added to the current admin console, the feature should live in:

- `app/admin/users/page.tsx`

as a clearly separate action like:

- `Invite User`

not as a hidden side effect of approval or credit grant actions.

### Product boundary

This feature is appropriate for:

- internal platform admin

It is not automatically appropriate for:

- workspace owners
- brand admins
- future organization admins

Those external roles should get separate permission checks and likely separate product surfaces.

---

## Maintenance Rules

### 1. Always enforce admin access on the server

Every admin API must call:

- `requireAdmin()`

Never trust:

- hidden navigation
- client redirects
- UI-only checks

### 2. Keep admin reporting separate from user-facing reporting

Admin reporting can expose:

- cross-user counts
- user emails
- operational error summaries
- internal ledger details

User-facing reporting must not reuse these responses directly.

### 3. Prefer dedicated ledgers over inferred joins

For observability:

- `chat_run` owns main chat request reporting
- `workspace_ai_run` owns workspace assist reporting
- `tool_run` owns tool execution reporting

Do not rebuild runtime summaries by stitching together unrelated tables if a dedicated run ledger already exists.

### 4. Keep mutations narrow

Admin mutations should stay explicit and low-ambiguity:

- approve user
- revoke approval
- grant credits
- invite user

Avoid broad catch-all admin mutation endpoints with many unrelated behaviors.

### 5. Treat dashboard cards as convenience only

If a number is shown on the dashboard and also on a detail page:

- the detail page/API is the source of truth
- the dashboard is a summary view

### 6. Do not accidentally turn internal admin into customer admin

The current admin console is built for platform operators.

Do not:

- expose `app/admin` to normal users
- reuse `requireAdmin()` for workspace-owner features
- assume internal admin UX is suitable for external customers

Customer-facing group admin should be built as a separate role and surface.

### 7. Keep onboarding aligned with the auth system

If admin-created users are added later:

- prefer invite/provisioning over direct password creation
- preserve email ownership verification
- avoid creating a parallel auth model just for admin convenience

The auth system in `lib/auth.ts` should remain the canonical source for:

- sign-in methods
- verification requirements
- post-create hooks such as signup credits and approval defaults

---

## Known Tradeoffs And Current Gaps

These are important for future maintainers.

### Dashboard credit total

The dashboard currently calculates “Credits in Circulation” from only the fetched preview users, not from a full system aggregate.

Impact:

- the number is useful as a quick glance
- it is not a canonical platform-wide balance total

### Credit transactions pagination

The current credit transaction API returns rows only.

Impact:

- pagination is heuristic in the UI
- total counts and final page awareness are not yet available

### Unified AI runs scalability

The current `GET /api/admin/ai-runs` route fetches capped slices from each runtime, merges them in memory, and paginates after the merge.

Impact:

- works for current internal scale
- will need redesign if admin traffic or run volume grows significantly

### Layout access check

The admin layout uses an API call to verify access client-side.

Impact:

- good enough for current UX
- not the security boundary

---

## Relationship To Other Systems

### Credits

The admin console can inspect and mutate user credits, but the underlying credit model is still user-centric.

Current helpers live in:

- `lib/credits.ts`

Future team or organization credit pools should not be hacked into the current admin screens without a deliberate product/data-model change.

### Workspace collaboration

Workspace membership and approvals exist elsewhere in the product and are not the same as internal admin access.

Do not conflate:

- internal platform admin
- workspace member
- brand owner
- future organization admin

### Observability docs

The AI runs admin surfaces build on the observability work described in:

- `docs/ai-audit-observability-implementation.md`
- `docs/workspace-ai-assist-implementation.md`

The detailed plan for admin-managed user onboarding is described in:

- `docs/admin-user-invite-implementation-plan.md`

If you change runtime audit fields:

- update the admin API responses if needed
- update the admin page expectations
- update the relevant implementation docs

---

## Recommended Change Process

When adding or changing admin features, follow this order:

1. define whether the feature is truly internal admin or belongs in a customer-facing workspace/org dashboard
2. identify the source-of-truth tables
3. add or update the admin API route first
4. keep response shape small and reporting-oriented
5. add the UI page or extend an existing page
6. verify `requireAdmin()` is still enforced
7. update this document if the admin architecture meaningfully changed

---

## When To Introduce A Shared Admin Query Layer

Create a shared `features/admin/` layer only when several of these become true:

- multiple admin routes need the same summaries
- routes begin duplicating aggregation logic
- admin pages need shared schemas/types
- tests become hard to maintain because logic lives only in route files

Until then:

- route-local query logic is acceptable

---

## Suggested Future Directions

Likely future admin improvements:

- true aggregate metrics for dashboard cards
- proper total-count pagination for credits and users
- CSV/export support
- chart components for AI trends
- stronger role model than email allowlist
- internal audit log for admin actions

Important product distinction:

- a future **group admin** or **organization admin** surface should likely be a new feature area, not a simple extension of `app/admin`

That future surface would need:

- workspace/org roles
- scoped permissions
- shared credit pool controls
- member-level usage reporting

Those needs are different enough from the internal operator console that they should be designed intentionally.

---

## Definition Of Done For Admin Changes

An admin change is complete when:

- the route is server-gated with `requireAdmin()`
- the UI uses admin APIs rather than embedding privileged logic client-side
- the source-of-truth table or ledger remains clear
- the feature does not blur internal admin and customer-facing roles
- the page still works on desktop and mobile layouts
- this document is updated if the admin architecture changed materially

---

## Final Guidance

The current admin area is best thought of as:

- an internal operator console
- a reporting surface over multiple ledgers
- a manual intervention tool for user approval and credits

Maintain it with those boundaries in mind.

If future work starts to look like:

- team management
- organization billing
- group credit sharing
- workspace-owner controls

pause and confirm whether the work belongs in `app/admin` at all.

That one distinction will prevent a lot of long-term confusion.
