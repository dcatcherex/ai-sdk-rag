# Admin User Invite Implementation Plan

## Purpose

This document defines the recommended implementation plan for allowing internal admins to add users to Vaja through an admin-managed invite flow.

It is intended for:

- AI coding agents implementing the feature
- developers maintaining onboarding and admin flows
- future contributors extending admin-managed provisioning

This plan is intentionally scoped to:

- **internal platform admin**

It is not a plan for:

- workspace-owner invites
- brand admin invites
- organization customer onboarding

Those should be designed separately with their own permission model.

---

## Implementation Progress

Status in the current codebase:

- Phase 1 complete
- Phase 2 complete
- Phase 3 complete
- Phase 4 complete
- Phase 5 complete

Implemented files now include:

- `db/schema/admin.ts`
- `db/migrations/0050_admin_user_invite.sql`
- `features/admin/invites/schema.ts`
- `features/admin/invites/service.ts`
- `features/admin/invites/types.ts`
- `app/api/admin/users/invite/route.ts`
- `app/api/admin/users/invite/[inviteId]/resend/route.ts`
- `app/api/admin/users/invite/[inviteId]/cancel/route.ts`
- `app/api/invite/[token]/claim/route.ts`
- `app/invite/[token]/page.tsx`
- updates to `app/admin/users/page.tsx`
- updates to `app/sign-in/page.tsx`
- updates to `app/verified/page.tsx`
- updates to `lib/email-templates.tsx`

Important routing note:

- the public claim endpoint ships as `POST /api/invite/[token]/claim`
- this differs from the original draft route under `/api/admin/users/invite/[token]/claim`
- the change was required because Next.js does not allow different dynamic segment names at the same path depth
- it is also a better semantic fit because claiming an invite is a user action, not an admin action

---

## Problem Statement

The current admin console can:

- list users
- approve users
- revoke approval
- grant credits

But it cannot:

- create a user invite from the admin UI
- onboard a user before they self-register
- track whether an invited user has accepted access

That makes pilot onboarding awkward for:

- first customer cohorts
- operator-assisted rollout
- small groups where one admin wants to prepare access for multiple people

Today the flow is effectively:

1. user signs up themselves
2. user verifies email
3. user may be blocked by approval requirement
4. internal admin later approves them

For pilot usage, a better flow is:

1. admin invites user
2. user accepts via existing auth methods
3. system links the accepted account to the invite
4. admin can see invite status

---

## Current State

Relevant current files:

- `app/admin/users/page.tsx`
- `app/api/admin/users/route.ts`
- `lib/admin.ts`
- `lib/auth.ts`
- `app/sign-in/page.tsx`
- `lib/email.ts`
- `lib/email-templates.tsx`

Current auth characteristics:

- Better Auth is configured in `lib/auth.ts`
- email verification is enabled
- email/password sign-up is enabled
- magic link sign-in is enabled
- Google OAuth is optional
- approval gating may be enabled through `REQUIRE_APPROVAL`
- signup bonus credits are granted in auth create hooks

Current admin characteristics:

- admin access is controlled by `ADMIN_EMAILS`
- the admin users page now manages both existing users and admin invites
- invite lifecycle now persists in `admin_user_invite`
- admin-originated onboarding email is implemented via `AdminInviteEmail`

Important implementation detail:

- `app/sign-in/page.tsx` now preserves `next` callback URLs
- invite acceptance returns to `app/invite/[token]/page.tsx` after sign-in or verification

---

## Product Decision

The recommended feature is:

- **admin invite / provisioning**

not:

- **admin manually creating an active password-based account**

### Why this is the right model

It matches the existing auth system:

- email ownership remains verified
- magic link remains available
- Google sign-in remains available
- the user still controls first sign-in

### What the feature should do

The admin should be able to:

- enter a name and email
- optionally set auto-approval
- optionally set an initial credit grant
- send an invite email
- resend an invite
- cancel an invite
- view invite acceptance state

The user should be able to:

- open the invite link
- sign in or sign up with the invited email
- have the invite automatically claimed after authentication

---

## Non-Goals

This implementation should not try to solve all onboarding and org management needs at once.

Not in scope for v1:

- workspace membership assignment
- organization/team credit pools
- bulk CSV imports
- admin-created passwords
- impersonation
- enterprise SCIM-style provisioning
- customer-facing invite permissions

---

## Target State

The target operator flow should be:

1. admin opens `Users`
2. admin clicks `Invite User`
3. admin enters:
   - name
   - email
   - optional initial credits
   - optional auto-approve flag
4. system stores invite record
5. system sends invite email
6. admin sees status `invited`
7. user opens invite link
8. user signs in or signs up with the same email
9. invite is claimed automatically
10. admin sees status `accepted`

Optional future statuses:

- `expired`
- `cancelled`

---

## Recommended Architecture

Use a dedicated invite persistence model and a dedicated admin route family.

Recommended additions:

```text
db/schema/admin.ts
db/migrations/00xx_admin_user_invite.sql

features/admin/
  invites/
    schema.ts
    service.ts
    types.ts

app/api/admin/users/invite/route.ts
app/api/admin/users/invite/[inviteId]/resend/route.ts
app/api/admin/users/invite/[inviteId]/cancel/route.ts
app/api/invite/[token]/claim/route.ts

app/invite/[token]/page.tsx
```

If the team wants to avoid introducing `features/admin/` yet, v1 can keep the logic close to the routes, but the service layer is recommended here because:

- the invite lifecycle has real state transitions
- email sending will be reused
- acceptance logic should not live only in route files

---

## Recommended Data Model

Add a dedicated table:

```text
admin_user_invite
```

Recommended fields:

- `id`
- `email`
- `name`
- `status`
- `token`
- `invited_by_user_id`
- `approved_on_accept`
- `initial_credit_grant`
- `expires_at`
- `accepted_at`
- `accepted_user_id`
- `cancelled_at`
- `last_sent_at`
- `created_at`
- `updated_at`

Recommended status values:

- `invited`
- `accepted`
- `expired`
- `cancelled`

### Why a separate table is needed

Do not try to represent invite lifecycle using only:

- the `user` table
- Better Auth verification rows

Those models serve different jobs.

The invite table should answer:

- who was invited
- by which admin
- whether the invite is still valid
- whether it was claimed
- whether approval and starting credits should be applied on accept

### Suggested indexes

- `email`
- `status`
- `token`
- `invited_by_user_id`
- `expires_at`
- `accepted_user_id`

---

## Auth Integration Strategy

### Core principle

Do not replace the current auth model.

The invite flow should sit on top of:

- Better Auth
- email verification
- magic link
- optional Google sign-in

### Recommended acceptance rule

An invite is accepted when:

1. the user has a valid authenticated session
2. the session email matches the invite email exactly or case-insensitively
3. the invite is still active
4. the invite has not already been accepted or cancelled

### Recommended claim side effects

When an invite is claimed:

- mark invite `accepted`
- set `accepted_at`
- set `accepted_user_id`
- if `approved_on_accept = true`, set `user.approved = true`
- if `initial_credit_grant > 0`, grant credits once

Important rule:

- do not grant credits multiple times if claim is retried

### Recommended callback strategy

Because `app/sign-in/page.tsx` currently uses fixed callback URLs, there are two safe implementation options.

#### Option A: Dedicated invite landing page

Recommended default.

Flow:

1. email links to `app/invite/[token]/page.tsx`
2. page validates token server-side
3. if user is not signed in, redirect to sign-in with invite context
4. after sign-in, return to invite page
5. invite page calls claim endpoint

Why this is good:

- cleaner UX
- less coupling to sign-in page internals
- easier to debug

#### Option B: Extend sign-in page to preserve invite callback

Flow:

1. email links to `/sign-in?invite=...&email=...&next=/invite/...`
2. sign-in page preserves callback URL through auth actions
3. user returns to invite page after auth
4. invite is claimed there

Why this is acceptable:

- smaller surface area

Why it is riskier:

- more moving parts in auth callbacks
- sign-in page becomes more stateful

Recommendation:

- use **Option A**

---

## Email Strategy

Use existing infrastructure:

- `lib/email.ts`
- `lib/email-templates.tsx`

Add a new email template:

- `AdminInviteEmail`

The invite email should contain:

- app name
- inviter context if helpful
- invite expiration
- CTA button
- fallback plain link

The CTA should point to:

- `app/invite/[token]/page.tsx`

Do not try to send a raw Better Auth magic link directly from the admin route unless the auth library usage clearly supports that server-side path cleanly.

For v1, the invite email should be:

- a Vaja invite email

not:

- a hidden direct magic-link sign-in email

---

## API Plan

### `POST /api/admin/users/invite`

Goal:

- create invite record and send invite email

Request shape:

- `email`
- `name?`
- `approvedOnAccept?`
- `initialCreditGrant?`
- `expiresInDays?`

Response shape:

- invite metadata
- delivery timestamp

Validation rules:

- valid email required
- positive initial credit grant only
- enforce reasonable expiration window

Recommended behavior:

- if user already exists, still allow invite if it is meant as access activation
- avoid duplicate active invites for the same email unless replacing old one intentionally

### `POST /api/admin/users/invite/[inviteId]/resend`

Goal:

- resend the invite email

Rules:

- only active invites can be resent
- refresh `last_sent_at`
- do not mutate accepted invites

### `POST /api/admin/users/invite/[inviteId]/cancel`

Goal:

- cancel an outstanding invite

Rules:

- accepted invites cannot be cancelled
- cancelled invites remain in history

### `POST /api/invite/[token]/claim`

Goal:

- claim invite after the user is authenticated

Rules:

- session required
- invite must be active
- invite email must match session email
- claim must be idempotent

### `GET /api/admin/users/invite`

Optional but recommended.

Goal:

- list invites for admin reporting

Useful filters:

- `status`
- `search`
- `page`

---

## UI Plan

### Admin users page

Extend:

- `app/admin/users/page.tsx`

Recommended additions:

- `Invite User` button
- invite dialog or drawer
- invite status list/table section
- resend and cancel actions

Suggested UI split:

- existing users table
- pending invites table

Why:

- invites and users are related but not identical states
- mixing them into one table makes edge cases harder to read

### Invite landing page

Add:

- `app/invite/[token]/page.tsx`

Responsibilities:

- validate invite token
- show invite details
- redirect unauthenticated users into sign-in
- claim invite after auth
- show accepted / expired / cancelled states clearly

Important rule:

- this page should not require admin access
- it is part of the invite acceptance flow, not the admin console

---

## Service Layer Plan

Recommended service module:

```text
features/admin/invites/service.ts
```

Suggested functions:

- `createAdminUserInvite()`
- `resendAdminUserInvite()`
- `cancelAdminUserInvite()`
- `getAdminUserInvites()`
- `getAdminUserInviteByToken()`
- `claimAdminUserInvite()`
- `sendAdminInviteEmail()`

The service should own:

- invite lifecycle transitions
- email sending
- one-time claim side effects

The route should own:

- admin auth
- request parsing
- response formatting

---

## Credit Handling

If initial credits are supported, use existing credit helpers:

- `lib/credits.ts`

Recommended rule:

- initial credit grant happens on invite acceptance
- not at invite creation time

Why:

- credits should attach to a real user account
- cancelled or expired invites should not consume credit grants

Implementation rule:

- grant once only
- include a clear transaction description such as:
  - `Admin invite acceptance bonus`

---

## Approval Handling

If `REQUIRE_APPROVAL` is enabled globally, invite acceptance should still work cleanly.

Recommended behavior:

- if `approvedOnAccept = true`, claim flow sets `user.approved = true`
- if `approvedOnAccept = false`, user remains pending after acceptance

This lets internal admin choose between:

- ready-to-use invite
- invite now, approve later

---

## Suggested Phase Plan

## Phase 1: Persistence and service foundation

### Goal

Create a durable invite lifecycle model before adding UI.

### Deliverables

- `admin_user_invite` schema
- migration
- invite service functions

### Target files

- new: `db/schema/admin.ts`
- new: migration in `db/migrations/`
- new: `features/admin/invites/service.ts`
- optional: `features/admin/invites/schema.ts`
- optional: `features/admin/invites/types.ts`

### Tasks

- add invite table
- define statuses
- add token generation and expiration logic
- add idempotent claim logic

### Acceptance criteria

- invites can be created, cancelled, and claimed safely
- claim side effects are not duplicated

## Phase 2: Admin API routes

### Goal

Expose the lifecycle through internal admin routes.

### Deliverables

- create invite route
- resend invite route
- cancel invite route
- optional list invites route

### Target files

- new: `app/api/admin/users/invite/route.ts`
- new: `app/api/admin/users/invite/[inviteId]/resend/route.ts`
- new: `app/api/admin/users/invite/[inviteId]/cancel/route.ts`
- optional: `app/api/admin/users/invite/list/route.ts`

### Tasks

- validate input with Zod
- enforce `requireAdmin()`
- wire service functions

### Acceptance criteria

- admin can manage invites without touching DB manually

## Phase 3: Invite email and landing flow

### Goal

Let invited users accept access through existing auth methods.

### Deliverables

- invite email template
- invite landing page
- claim endpoint

### Target files

- `lib/email-templates.tsx`
- new: `app/invite/[token]/page.tsx`
- new: `app/api/invite/[token]/claim/route.ts`
- possible update: `app/sign-in/page.tsx`

### Tasks

- add email template
- add invite validation page
- redirect unauthenticated users to sign-in
- return them to invite page after auth
- claim invite once authenticated

### Acceptance criteria

- user can complete invite acceptance without manual admin intervention

## Phase 4: Admin UI

### Goal

Add operator-facing invite controls to the users page.

### Deliverables

- invite dialog
- invite list
- resend action
- cancel action

### Target files

- `app/admin/users/page.tsx`
- optional: new invite-specific UI components under `features/admin/` or `app/admin/users/`

### Tasks

- add `Invite User` action
- collect email, name, approval, starting credits
- show invite state separately from user state

### Acceptance criteria

- operators can invite users end-to-end from the admin UI

## Phase 5: Hardening and polish

### Goal

Make the flow resilient and easy to maintain.

### Deliverables

- duplicate invite handling
- expired invite handling
- error messages
- audit-friendly admin actions

### Tasks

- make claim idempotent
- prevent invalid resends
- add useful descriptions to credit transactions
- add clear UI copy for accepted/expired/cancelled invites
- update docs

### Acceptance criteria

- support and debugging burden stays low
- invite lifecycle is understandable from DB and UI state

Current progress notes:

- duplicate active invites are replaced for the same normalized email
- claim is idempotent and credit grant is guarded by `credit_granted_at`
- invalid resend and cancel actions return explicit errors
- accepted, expired, and cancelled states are visible in both admin and public UI
- invite history supports server-side status filtering and pagination
- invite history now includes richer admin audit context for inviter, acceptance, and grant timing
- docs are updated to reflect shipped behavior

---

## Security Rules

### 1. Email ownership must still be verified

Do not treat admin invite creation as proof that the user owns the email.

### 2. Invite claim must require authentication

Do not claim an invite purely from token possession.

### 3. Invite email must match authenticated email

The claim route must compare:

- invite email
- session email

### 4. Claims must be idempotent

Retries or duplicate requests must not:

- create multiple grants
- toggle approval repeatedly
- attach the invite to different users

### 5. Admin routes must stay admin-only

Everything under:

- `/api/admin/users/invite`

must remain protected by `requireAdmin()`.

### 6. Acceptance routes must not leak sensitive state

Public invite pages may reveal:

- whether invite is valid
- whether invite is expired

They should not reveal:

- internal admin email allowlist
- other user records
- internal system details

---

## Risks

### Risk: duplicate active invites for one email

Mitigation:

- enforce one active invite per email
- explicitly replace or reuse older active invite

### Risk: accepted invite after account already existed

Mitigation:

- allow claim if authenticated email matches
- treat this as linking an existing user to the invite

### Risk: approval and credit side effects run twice

Mitigation:

- make claim transactionally safe
- guard accepted state before applying side effects

### Risk: sign-in callback flow becomes fragile

Mitigation:

- prefer dedicated invite page over complex sign-in query logic

### Risk: admin onboarding gets confused with workspace onboarding

Mitigation:

- keep this feature internal-admin-only
- do not reuse the exact routes for customer-facing invites later

---

## Open Questions

These should be decided before implementation starts:

1. Should invites auto-approve by default, or require the admin to opt in?
2. Should initial credits default to zero or a configurable amount?
3. How long should invites remain valid?
4. Should an existing user be invitable again for activation/reactivation workflows?
5. Should accepted invites remain visible forever in the admin UI, or move to user history only?

Recommended defaults:

1. auto-approve: `true` for internal admin invites
2. initial credits: `0`
3. expiry: `7 days`
4. existing user re-invite: `yes`, if email matches and invite purpose is still valid
5. visibility: keep accepted invites visible for audit history

---

## Recommended Implementation Order

1. add schema and migration
2. implement service layer
3. implement admin routes
4. implement invite landing and claim flow
5. implement admin UI
6. harden edge cases
7. update docs

---

## Definition Of Done

The admin invite feature is complete when:

- internal admin can create an invite from the admin UI
- invite email is sent successfully through existing email infra
- invited user can authenticate through existing auth methods
- invite is claimed only when authenticated email matches
- approval and starting credits are applied safely once
- admin can see whether the invite is invited, accepted, expired, or cancelled
- the implementation does not introduce admin-created password accounts
- the admin guide is updated to reflect shipped behavior

---

## Final Guidance

The success condition is not merely:

- “admin can add user rows”

The real success condition is:

- admin can onboard users safely
- the flow fits the existing auth architecture
- the invite lifecycle is understandable
- the system stays maintainable

If future contributors are tempted to bypass verification or create direct password accounts for convenience, stop and re-evaluate.

That shortcut would create a second auth model, and this plan is specifically designed to avoid that.
