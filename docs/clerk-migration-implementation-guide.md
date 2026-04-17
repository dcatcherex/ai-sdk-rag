# Clerk Migration Implementation Guide

**Status:** ✅ Migration Complete — Pending QA (2026-04-17)
**Audience:** AI coders + human developers maintaining Vaja AI
**Scope:** Replace Better Auth with Clerk as the primary authentication provider, keeping all downstream code (skills, agents, credits, content, LINE OA, etc.) untouched.

---

## 0. Implementation Progress

### Phase 1 — Infrastructure ✅ Complete (2026-04-17)
| Area | Status |
|------|--------|
| `@clerk/nextjs@7` + `svix` installed | ✅ |
| `proxy.ts` — `clerkMiddleware()` with public route matcher | ✅ |
| `app/layout.tsx` wrapped in `<ClerkProvider>` | ✅ |
| `lib/auth-server.ts` — `getCurrentUser`, `requireUser`, `requireAdmin` | ✅ |
| `lib/auth-client.ts` — Clerk hooks + `authClient` compat shim | ✅ |
| `lib/admin.ts` + `lib/admin-emails.ts` refactored to re-export from seam | ✅ |
| `lib/auth.ts` — Clerk-backed shim for legacy `auth.api.getSession` callers | ✅ |
| `/sign-in/[[...rest]]/page.tsx` + `/sign-up/[[...rest]]/page.tsx` | ✅ |
| `/api/webhooks/clerk/route.ts` — Svix-verified, idempotent, handles lifecycle | ✅ |
| `features/admin/invites/service.ts` — rewritten to use `clerkClient.invitations` | ✅ |
| Old sign-in, invite, setup-password, magic-link files deleted | ✅ |

### Phase 2 — Mass caller refactor ✅ Complete (2026-04-17)
| Area | Status |
|------|--------|
| 191 route files → `requireUser()` (Pattern A) | ✅ |
| 3 routes with guest/optional auth → `getCurrentUser()` (Pattern B) | ✅ |
| `app/api/chat/route.ts` — restructured `Promise.all` + `getCurrentUser()` | ✅ |
| `lib/support.ts`, `lib/quiz-print.ts` — helper functions updated | ✅ |
| Stale `import { auth } from '@/lib/auth'` removed where no longer used | ✅ |
| `pnpm exec tsc --noEmit` — zero errors | ✅ |

### Phase 3 — Schema cleanup ✅ Complete (2026-04-17)
| Area | Status |
|------|--------|
| `session`, `account`, `verification` removed from `db/schema/auth.ts` | ✅ |
| `userRelations` for session/account removed | ✅ |
| `clerkInvitationId` column added to `db/schema/admin.ts` | ✅ |
| `features/line-oa/link/service.ts` — removed dead `accountTable` insert | ✅ |
| Migration applied directly to Neon via SQL console | ✅ |
| Webhook idempotency fixed — checks by email, not just Clerk ID | ✅ |
| Existing Better Auth users migrated to Clerk IDs via SQL | ✅ |
| New users created directly in Clerk Dashboard → webhook auto-creates DB row | ✅ |

### Phase 4 — QA ⏳ Pending
See §15 for full testing checklist.

### What remains
1. QA against §15 checklist
2. (Optional) Delete `lib/auth.ts` shim after 2 weeks of stable operation

---

## 1. Why We're Migrating

The current Better Auth + custom invite flow has **5 entry paths** that all mutate `user`, `account`, `session`, `verification`, `adminUserInvite`, and `userCredit` in different orders. This produces recurring bugs:

- Pre-created passwordless `user` rows collide with real signup attempts
- Signup-bonus credits get double-granted (invite creation + `databaseHooks.after`)
- Email-case mismatches between Better Auth writes and our `lower(email)` lookups
- `approved` flag gets overwritten by `databaseHooks.after` when `REQUIRE_APPROVAL=true`
- Custom magic-link verification rows depend on Better Auth's internal schema (fragile across upgrades)

For an MVP under 100 users, **Clerk eliminates all this surface area** while keeping our DB and feature code intact. The free tier covers 10,000 MAU, so cost is irrelevant at our scale.

---

## 2. Architecture After Migration

```
Clerk (hosted)                       Our app (Neon + Drizzle)
─────────────────                    ─────────────────────────
Sign-in / sign-up         ─────►     middleware.ts
Magic link / OAuth                   └─ clerkMiddleware()
Email verification                   └─ guards routes; checks
Invitations (with metadata)             publicMetadata.approved

Webhooks ─────────────────────►      /api/webhooks/clerk
                                     └─ user.created → upsert user row,
user.created                            grant signup credits,
user.updated                            apply approval policy,
user.deleted                            handle invite metadata
                                     └─ user.deleted → soft delete
```

**Key design rule:**
The `user` table in `db/schema/auth.ts` is **kept** as the canonical app-side user record. Its `id` column will store the Clerk `userId` (Clerk uses `user_xxx` string IDs, which fit the existing `text` PK). This means **no FK changes** are needed across the 237 files that reference `user.id`.

The `session`, `account`, and `verification` tables are **dropped** (Clerk owns sessions).

---

## 3. The One Rule for Auth Calls

> **Never call Clerk SDK directly from feature code. Always go through `@/lib/auth-server.ts` or `@/lib/auth-client.ts`.**

These two files become the only seam between our app and Clerk. If we ever need to swap providers again, only these files change.

```ts
// Server (route handlers, server components, server actions)
import { getCurrentUser, requireUser, requireAdmin } from "@/lib/auth-server";

// Client (React components, hooks)
import { useCurrentUser } from "@/lib/auth-client";
```

---

## 4. New File Layout

```
lib/
  auth-server.ts          ← getCurrentUser, requireUser, requireAdmin (server-only)
  auth-client.ts          ← useCurrentUser hook + re-exports of <SignedIn/>, etc.
  admin.ts                ← isAdminEmail (unchanged) + requireAdmin re-exported from auth-server

proxy.ts                  ← clerkMiddleware() with public route matcher (Next 16 convention)

app/
  layout.tsx              ← wrap children in <ClerkProvider>
  sign-in/[[...rest]]/page.tsx   ← <SignIn /> component
  sign-up/[[...rest]]/page.tsx   ← <SignUp /> component
  api/
    webhooks/clerk/route.ts      ← Svix-verified webhook handler

  invite/[token]/page.tsx        ← REMOVED (Clerk owns invite UX)
  api/invite/[token]/auto-login/route.ts    ← REMOVED
  api/invite/[token]/auto-verify/route.ts   ← REMOVED
  api/invite/[token]/claim/route.ts         ← REMOVED
  api/setup-password/route.ts               ← REMOVED
  api/auth/[...betterauth]/route.ts         ← REMOVED

lib/auth.ts               ← REMOVED (replaced by auth-server.ts)
lib/server/magic-link.ts  ← REMOVED
```

---

## 5. Schema Changes

### Keep (with notes)

| Table | Change |
|-------|--------|
| `user` | Keep. `id` now stores Clerk userId. Drop `emailVerified` column (Clerk source of truth — query Clerk if you need it). Keep `approved` for our approval gate. |
| `userPreferences`, `userMemory`, `userModelPreference`, etc. | No change. FKs still point to `user.id`. |
| `userCredit`, `creditTransaction` | No change. |
| `adminUserInvite` | Keep as **audit log only**. Stores Clerk invitation IDs and metadata snapshot. No magic-link generation. |

### Drop

| Table | Why |
|-------|-----|
| `session` | Clerk owns sessions. |
| `account` | Clerk owns OAuth + credential linking. |
| `verification` | Clerk owns email verification + magic links. |

### Migration SQL (new file: `db/migrations/00XX_clerk_migration.sql`)

```sql
-- Drop Better Auth tables (after data migration script — see §9)
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;

-- Optional: drop emailVerified (Clerk is source of truth)
ALTER TABLE "user" DROP COLUMN IF EXISTS "email_verified";

-- Add column to track Clerk invitation IDs in our audit log
ALTER TABLE "admin_user_invite"
  ADD COLUMN IF NOT EXISTS "clerk_invitation_id" text;
```

After running, regenerate Drizzle:

```powershell
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 6. Environment Variables

Add to `.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/welcome
```

**Remove:**

```
BETTER_AUTH_URL=
BETTER_AUTH_SECRET=
GOOGLE_CLIENT_ID=         # configure inside Clerk dashboard instead
GOOGLE_CLIENT_SECRET=     # configure inside Clerk dashboard instead
```

**Keep:**

```
ADMIN_EMAILS=             # still our authoritative admin list
RESEND_API_KEY=           # still used for non-auth transactional email
DISABLE_SIGNUP=           # enforced via Clerk dashboard "Restrictions" + middleware
REQUIRE_APPROVAL=         # enforced in middleware via publicMetadata.approved
```

---

## 7. The Auth Seam (`lib/auth-server.ts` and `lib/auth-client.ts`)

This is the **only** abstraction layer. Every feature route must use it.

### `lib/auth-server.ts`

```ts
import "server-only";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "@/lib/admin";

export type AppUser = {
  id: string;          // Clerk userId, also PK in our user table
  email: string;
  name: string;
  image: string | null;
  approved: boolean;
};

/** Returns the current user or null. Use in optional-auth contexts. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    approved: row.approved,
  };
}

/** Returns the current user or a 401 Response. Use in API routes that require auth. */
export async function requireUser(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: Response }
> {
  const u = await getCurrentUser();
  if (!u) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user: u };
}

/** Returns the current user if admin, or a 401/403 Response. */
export async function requireAdmin(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: Response }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!isAdminEmail(auth.user.email)) {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden: admin only" }, { status: 403 }),
    };
  }
  return auth;
}

export { clerkClient, currentUser };
```

### `lib/auth-client.ts`

```ts
"use client";
// NOTE: Use `<Show when="signed-in">` / `<Show when="signed-out">` from
// @clerk/nextjs for conditional rendering. The old `<SignedIn>` / `<SignedOut>`
// components are deprecated in Clerk 7+.
export { useUser, useAuth, UserButton, SignInButton, SignUpButton, SignOutButton } from "@clerk/nextjs";

import { useUser } from "@clerk/nextjs";

export function useCurrentUser() {
  const { user, isLoaded, isSignedIn } = useUser();
  return {
    isLoaded,
    isSignedIn,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? "",
          name: user.fullName ?? user.username ?? "",
          image: user.imageUrl,
        }
      : null,
  };
}
```

---

## 8. Proxy (Request Interception)

Next.js 16 + Clerk 7 uses `proxy.ts` at the project root (replaces the older `middleware.ts` convention). The exported `clerkMiddleware()` function name stays the same.

```ts
// proxy.ts (root)
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk",
  "/api/line/webhook",        // LINE webhook — verifies its own signature
  "/agent/(.*)",              // public agent share links
  "/api/agents/(.*)/public-share",
  "/",                        // guest-enabled landing
  "/api/guest/init",
  "/api/user/status",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Do not reintroduce `middleware.ts`.** Both files cannot coexist; Next 16 prefers `proxy.ts`.

---

## 9. Webhook Handler

This **replaces** `databaseHooks` from `lib/auth.ts`. It is the **single source of truth** for user lifecycle side effects.

```ts
// app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { user as userTable, adminUserInvite } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addCredits } from "@/lib/credits";
import { getPlatformSettings } from "@/lib/platform-settings";
import { isAdminEmail } from "@/lib/admin";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) return new Response("Webhook secret missing", { status: 500 });

  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await req.text();
  let evt: WebhookEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "user.created":   await handleUserCreated(evt.data); break;
    case "user.updated":   await handleUserUpdated(evt.data); break;
    case "user.deleted":   await handleUserDeleted(evt.data); break;
  }

  return new Response("ok");
}

async function handleUserCreated(data: any) {
  const id: string = data.id;
  const email: string = data.email_addresses?.[0]?.email_address?.toLowerCase() ?? "";
  const name: string =
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.username ||
    email.split("@")[0];
  const image: string | null = data.image_url ?? null;

  // Read invitation metadata (set when admin sent the invite)
  const inviteMeta = data.public_metadata ?? {};
  const fromInvite = !!inviteMeta.invitedBy;
  const approvedOnAccept = inviteMeta.approvedOnAccept === true;
  const initialCreditGrant: number =
    typeof inviteMeta.initialCreditGrant === "number" ? inviteMeta.initialCreditGrant : 0;

  const settings = await getPlatformSettings();
  const requireApproval = process.env.REQUIRE_APPROVAL === "true";
  const isAdmin = isAdminEmail(email);
  const approved = isAdmin || !requireApproval || approvedOnAccept || fromInvite;

  await db
    .insert(userTable)
    .values({
      id,
      email,
      name,
      image,
      approved,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  // Signup bonus — only one place this happens now
  const bonus = fromInvite ? initialCreditGrant : settings.signupBonusCredits;
  if (bonus > 0) {
    await addCredits({
      userId: id,
      amount: bonus,
      type: fromInvite ? "invite_grant" : "signup_bonus",
      description: fromInvite
        ? `Invite grant: ${bonus} credits`
        : `Welcome bonus: ${bonus} credits`,
    });
  }

  // Mark the invite audit row accepted
  if (inviteMeta.inviteId) {
    await db
      .update(adminUserInvite)
      .set({
        status: "accepted",
        acceptedUserId: id,
        acceptedAt: new Date(),
        creditGrantedAt: bonus > 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(adminUserInvite.id, String(inviteMeta.inviteId)));
  }
}

async function handleUserUpdated(data: any) {
  const email = data.email_addresses?.[0]?.email_address?.toLowerCase();
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.username ||
    email?.split("@")[0];
  await db
    .update(userTable)
    .set({ email, name, image: data.image_url ?? null, updatedAt: new Date() })
    .where(eq(userTable.id, data.id));
}

async function handleUserDeleted(data: any) {
  if (!data.id) return;
  await db.delete(userTable).where(eq(userTable.id, data.id));
}
```

**Configure in Clerk dashboard:**
Webhooks → Add Endpoint → URL = `https://YOUR_DOMAIN/api/webhooks/clerk` → subscribe to `user.created`, `user.updated`, `user.deleted` → copy signing secret to `CLERK_WEBHOOK_SIGNING_SECRET`.

For local dev: use ngrok or Clerk's own dev tunnel.

---

## 10. The New Invite Flow

The **entire** invite system collapses to one Clerk API call.

### Admin sends invite

```ts
// features/admin/invites/service.ts (new createAdminUserInvite)
import { clerkClient } from "@/lib/auth-server";

export async function createAdminUserInvite(opts: {
  invitedByUserId: string;
  inviterName?: string | null;
  email: string;
  name?: string;
  approvedOnAccept?: boolean;
  initialCreditGrant?: number;
  expiresInDays?: number;
}) {
  const normalizedEmail = opts.email.trim().toLowerCase();

  // 1. Insert audit row first so we have an ID for metadata
  const [auditRow] = await db
    .insert(adminUserInvite)
    .values({
      id: nanoid(),
      email: normalizedEmail,
      name: opts.name ?? null,
      status: "invited",
      token: nanoid(32),                    // legacy column, kept for back-compat
      invitedByUserId: opts.invitedByUserId,
      approvedOnAccept: opts.approvedOnAccept ?? false,
      initialCreditGrant: opts.initialCreditGrant ?? 0,
      expiresAt: new Date(Date.now() + (opts.expiresInDays ?? 7) * 86400_000),
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // 2. Create Clerk invitation (Clerk sends the email)
  const client = await clerkClient();
  const invitation = await client.invitations.createInvitation({
    emailAddress: normalizedEmail,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/welcome`,
    publicMetadata: {
      inviteId: auditRow.id,
      invitedBy: opts.invitedByUserId,
      approvedOnAccept: opts.approvedOnAccept ?? false,
      initialCreditGrant: opts.initialCreditGrant ?? 0,
    },
    notify: true,                          // Clerk sends a branded invite email
    ignoreExisting: false,
  });

  // 3. Save Clerk invitation ID for resend/cancel
  await db
    .update(adminUserInvite)
    .set({ clerkInvitationId: invitation.id })
    .where(eq(adminUserInvite.id, auditRow.id));

  return auditRow;
}
```

### Resend / cancel

```ts
// Resend
await client.invitations.createInvitation({ ... });   // re-invoke, ignoreExisting:false will throw — handle by revoking first

// Cancel
await client.invitations.revokeInvitation({ invitationId });
```

### What the user experiences

1. Admin clicks "Invite" → Clerk sends a branded email
2. User clicks link → lands on Clerk-hosted sign-up form pre-filled with their email
3. User completes sign-up (password or OAuth)
4. Clerk webhook fires `user.created` → our `/api/webhooks/clerk` upserts user row, grants credits, marks invite accepted
5. User redirected to `/welcome`

**No `/invite/[token]` page. No magic-link generation. No `auto-verify`. No `setup-password`. No `claim` route.**

---

## 11. The Sign-In and Sign-Up Pages

```tsx
// app/sign-in/[[...rest]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn appearance={{ /* match Vaja brand */ }} />
    </div>
  );
}
```

```tsx
// app/sign-up/[[...rest]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp appearance={{ /* match Vaja brand */ }} />
    </div>
  );
}
```

Brand them through Clerk's `appearance` prop (see Clerk docs for theming variables — Tailwind v4 friendly).

---

## 12. Migrating the 237 Caller Sites

The seam in `auth-server.ts` mirrors the existing `requireAdmin` shape, so most changes are **pure import swaps**.

### Pattern A — Routes using `auth.api.getSession`

**Before:**
```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

**After:**
```ts
import { requireUser } from "@/lib/auth-server";

const auth = await requireUser();
if (!auth.ok) return auth.response;
const userId = auth.user.id;
```

### Pattern B — Routes using `requireAdmin`

**No change** — keep the import path, it just re-exports from `auth-server.ts`:

```ts
import { requireAdmin } from "@/lib/admin";   // unchanged
```

Inside `lib/admin.ts`:
```ts
export { requireAdmin } from "@/lib/auth-server";
export const isAdminEmail = (email: string): boolean =>
  ADMIN_EMAILS.includes(email);
```

### Pattern C — Client components using `authClient`

**Before:**
```ts
import { authClient } from "@/lib/auth-client";
await authClient.signOut();
```

**After:**
```ts
import { useClerk } from "@clerk/nextjs";
const { signOut } = useClerk();
await signOut({ redirectUrl: "/sign-in" });
```

### Recommended order of refactor

1. Create `auth-server.ts` and `auth-client.ts`
2. Refactor `lib/admin.ts` to re-export
3. Run a project-wide find/replace:
   - `auth.api.getSession({ headers: await headers() })` → `requireUser()` pattern
   - `import { auth } from "@/lib/auth"` → `import { requireUser } from "@/lib/auth-server"`
4. Run `pnpm exec tsc --noEmit` and fix breakages route by route
5. Delete `lib/auth.ts` only after type-check passes

---

## 13. Existing User Migration

For any existing Better Auth users (>0 in production):

```ts
// scripts/migrate-users-to-clerk.ts
import { db } from "@/lib/db";
import { user, account } from "@/db/schema";
import { clerkClient } from "@clerk/clerk-sdk-node";

const client = clerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const users = await db.select().from(user);
  for (const u of users) {
    // Look for existing credential password (bcrypt-hashed)
    const [cred] = await db.select().from(account)
      .where(/* userId = u.id AND providerId = "credential" */);

    const created = await client.users.createUser({
      externalId: u.id,                    // preserve old ID
      emailAddress: [u.email],
      firstName: u.name?.split(" ")[0],
      lastName: u.name?.split(" ").slice(1).join(" ") || undefined,
      passwordDigest: cred?.password ?? undefined,
      passwordHasher: cred?.password ? "bcrypt" : undefined,
      skipPasswordChecks: true,
    });

    // Update our user.id to Clerk's userId
    await db.update(user).set({ id: created.id }).where(/* id = u.id */);
  }
}

main().catch(console.error);
```

**Important:** Run this **before** dropping the `account` table. Test on staging first.

For ≤100 users, you can also send each one a Clerk invitation manually — they reset their password during signup.

---

## 14. Removed/Replaced Files Reference

| Removed | Replaced by |
|---------|------------|
| `lib/auth.ts` | `lib/auth-server.ts` |
| `lib/auth-client.ts` (Better Auth) | `lib/auth-client.ts` (Clerk wrappers) |
| `lib/server/magic-link.ts` | nothing — Clerk handles magic links |
| `app/api/auth/[...betterauth]/route.ts` | nothing — Clerk hosts auth endpoints |
| `app/sign-in/page.tsx` (custom 480-line form) | `app/sign-in/[[...rest]]/page.tsx` (`<SignIn />`) |
| `app/invite/[token]/page.tsx` | nothing — Clerk-hosted invite acceptance |
| `app/invite/[token]/invite-claim-client.tsx` | nothing |
| `app/api/invite/[token]/auto-login/route.ts` | nothing |
| `app/api/invite/[token]/auto-verify/route.ts` | nothing |
| `app/api/invite/[token]/claim/route.ts` | nothing |
| `app/api/setup-password/route.ts` | nothing |
| `databaseHooks` in `lib/auth.ts` | `app/api/webhooks/clerk/route.ts` |

---

## 15. Testing Checklist

Run before merging:

- [ ] `pnpm exec tsc --noEmit` — zero errors
- [ ] Sign up with email/password → user row created → signup credits granted exactly once
- [ ] Sign up with Google → user row created → signup credits granted exactly once
- [ ] Sign in with magic link → session works
- [ ] Admin invites a new email → email arrives → user signs up → invite credits granted (not double signup bonus) → invite audit row marked `accepted`
- [ ] Admin invites an already-Clerk-registered email → Clerk handles gracefully (returns existing user via webhook flow)
- [ ] `REQUIRE_APPROVAL=true` blocks unapproved users from protected routes
- [ ] `DISABLE_SIGNUP=true` (set via Clerk dashboard "Restrictions") blocks new signups
- [ ] Webhook signature verification rejects unsigned/forged payloads
- [ ] LINE OA webhook still works (it bypasses Clerk middleware)
- [ ] Public agent share links (`/agent/[token]`) still accessible without auth
- [ ] Sign out → session ends → protected routes redirect to `/sign-in`

---

## 16. Maintenance Rules (For Future AI Coders)

When working on auth in this codebase, follow these rules **without exception**:

1. **Never call `@clerk/nextjs` directly from feature code.** Always use `@/lib/auth-server` (server) or `@/lib/auth-client` (client). This is the swap-out seam.

2. **Never write to the `user` table from anywhere except the webhook handler.** The webhook is the single source of truth for user lifecycle.

3. **Never grant signup credits anywhere except the webhook handler.** Granting credits inline (in invite creation, sign-up handlers, etc.) caused double-grant bugs in the Better Auth era. Don't repeat that.

4. **Never store passwords or session data in our DB.** Clerk owns those. If you find yourself touching `password`, `session_token`, or `verification_code`, you're doing it wrong.

5. **Approval gate lives in middleware, not in auth.** Add `await auth.protect()` and a `publicMetadata.approved` check in `middleware.ts` if approval enforcement needs to be tighter than route-level checks.

6. **Invite metadata must travel via Clerk's `publicMetadata`.** Never invent a custom token system. The webhook reads metadata back to apply credits + approval.

7. **Always lowercase email when querying the `user` table.** Clerk normalizes emails, but we should still defensive-lowercase on writes from the webhook.

8. **Don't reintroduce a custom `/sign-in` form.** Use Clerk's `<SignIn />` and theme it via `appearance`. The custom form was 480 lines and the source of half the bugs.

9. **For LINE-linked users, the link is via `userMemory.lineUserId` and `userId`.** No change from current flow — Clerk doesn't know about LINE.

10. **When Clerk SDK changes shape (major version bumps), update only `auth-server.ts` and `auth-client.ts`.** All 237 caller sites should remain untouched.

---

## 17. Rough Effort Estimate

| Phase | Effort |
|-------|--------|
| Install + provider + middleware | 1 hour |
| `auth-server.ts` + `auth-client.ts` + `lib/admin.ts` refactor | 1 hour |
| Webhook handler | 2 hours |
| `/sign-in` + `/sign-up` pages | 30 min |
| Invite service rewrite + cancel/resend | 2 hours |
| Find/replace `auth.api.getSession` → `requireUser` across 237 files | 3 hours (mechanical) |
| Schema migration + drop tables | 30 min |
| Existing user migration script (skip if 0 users in prod) | 1–2 hours |
| QA against checklist in §15 | 2 hours |
| **Total** | **~2 working days** |

---

## 18. Rollback Plan

If something breaks in production:

1. Keep `lib/auth.ts` and Better Auth tables in a separate branch for 2 weeks post-cutover
2. Revert middleware + provider + auth-server.ts to point back at Better Auth
3. Don't drop `session`, `account`, `verification` tables until 2 weeks of stable Clerk operation

---

## 19. Useful Links

- Clerk + Next.js App Router: https://clerk.com/docs/quickstarts/nextjs
- Clerk Webhooks (Svix): https://clerk.com/docs/integrations/webhooks/overview
- Clerk Invitations API: https://clerk.com/docs/users/invitations
- Importing existing users: https://clerk.com/docs/deployments/migrate-from-better-auth (or generic import API)
- Theming `<SignIn/>`: https://clerk.com/docs/customization/overview
