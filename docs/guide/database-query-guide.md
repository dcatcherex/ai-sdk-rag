# Database Query Guide

> Audience: AI coders and developers writing or modifying any route, webhook, or service that reads from the database.
> Purpose: establish where queries live and how to write them so schema changes propagate in one place, not thirty.

---

## Core Rule

**Queries are not business logic. They belong in `queries.ts`, not inline in routes or services.**

A route or service should state *what* data it needs, not *how* to fetch it. If a caller has to write a Drizzle `select` expression to get a row, that knowledge is duplicated every time the same row is needed elsewhere.

---

## Where Query Files Live

Every domain feature that owns DB tables owns a `queries.ts` in its server directory.

```
features/
  agents/server/queries.ts      ← agent ownership, bare agent lookup
  chat/server/queries.ts        ← thread lookup, user approval, user prefs
  line-oa/server/queries.ts     ← channel lookup, conversation lookup (add as needed)
  skills/server/queries.ts      ← skill rows for agent (add as needed)
  ...
```

**Rule: one `queries.ts` per domain, colocated with the server code that uses it.**

Never put queries in `lib/` — `lib/` is for utilities with no domain ownership (credits, memory, AI clients). Never put queries inline in `app/api/` routes or webhook handlers.

---

## What a Query Helper Looks Like

A query helper is a single `async function` that:
- Takes the minimum inputs needed to identify the row(s)
- Returns a typed result or `null` — never throws on "not found"
- Does one thing — no branching business logic inside

```typescript
// features/chat/server/queries.ts
export async function checkUserApproved(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ approved: userTable.approved })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.approved ?? false;
}
```

The caller decides what to do with the result. The query helper does not call `Response.json`, does not throw HTTP errors, and does not contain conditional logic based on the result.

---

## Guest / Auth Branching Belongs in the Helper

When the same conceptual query has two variants (authenticated vs guest), the branching lives inside the helper — not spread across the caller with `isGuest ? ... : ...`:

```typescript
// features/chat/server/queries.ts
export async function getThreadForSession(input: {
  threadId: string;
  userId: string | null;
  guestSessionId: string | null;
}): Promise<{ id: string; title: string | null } | null> {
  const { threadId, userId, guestSessionId } = input;
  const rows = userId
    ? await db.select(...).from(chatThread).where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId))).limit(1)
    : guestSessionId
      ? await db.select(...).from(chatThread).where(and(eq(chatThread.id, threadId), eq(chatThread.guestSessionId, guestSessionId))).limit(1)
      : [];
  return rows[0] ?? null;
}
```

The caller passes `userId` and `guestSessionId` and gets back a result or `null`. It never sees the Drizzle expression.

---

## Ownership Checks Belong in the Helper

When a query includes authorization logic (e.g., "only return this agent if the user owns it, or it is public, or it is shared with them"), that logic lives entirely inside the helper:

```typescript
// features/agents/server/queries.ts
export async function getAgentForUser(agentId: string, userId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(
      and(
        eq(agent.id, agentId),
        or(
          eq(agent.userId, userId),
          eq(agent.isPublic, true),
          and(isNull(agent.userId), eq(agent.managedByAdmin, true), eq(agent.catalogStatus, 'published')),
          exists(db.select({ id: agentShare.agentId }).from(agentShare).where(...)),
        ),
      ),
    )
    .limit(1);
  return (row ?? null) as Agent | null;
}
```

If the caller gets `null` back, it knows access was denied or the record does not exist — it does not need to understand why.

**Provide separate helpers for different trust levels:**

| Helper | When to use |
|--------|-------------|
| `getAgentForUser(agentId, userId)` | Web chat, shared links — user-initiated requests that need ownership verification |
| `getAgentById(agentId)` | LINE webhook, run service — caller already knows the agent is valid for the context |

Never use `getAgentById` in a user-facing route where ownership matters.

---

## What to Keep Inline

Not every `db.select` needs extraction. Keep a query inline when:

- It is a one-off query for a scenario specific to that route (e.g., "count agents for a new user setup check")
- It reads a derived or aggregate value with no reuse potential
- It is inside a `service.ts` that is already the canonical logic owner for that domain

A query is worth extracting when it appears in more than one file, or when it contains branching/ownership logic that would otherwise be duplicated.

---

## Parallel Fetching Pattern

Query helpers are designed to be called inside `Promise.all`. The call site should read like a list of data needed, not a series of Drizzle expressions:

```typescript
// Correct — reads like a requirements list
const [userApproved, thread, prefs, balance, activeAgent] = await Promise.all([
  isGuest ? Promise.resolve(true) : checkUserApproved(effectiveUserId),
  getThreadForSession({ threadId, userId: isGuest ? null : effectiveUserId, guestSessionId }),
  isGuest ? Promise.resolve(null) : getUserPrefs(effectiveUserId),
  isGuest ? Promise.resolve(guestBalance) : getUserBalance(effectiveUserId),
  (!isGuest && agentId) ? getAgentForUser(agentId, effectiveUserId) : Promise.resolve(null),
]);

// Wrong — inline Drizzle expressions mixed with Promise.all
const [userRow, threadRows, prefsRows, balance, activeAgentRows] = await Promise.all([
  isGuest ? Promise.resolve([{ approved: true }]) : db.select({ approved: userTable.approved }).from(userTable)...,
  isGuest ? db.select(...).from(chatThread).where(and(eq(chatThread.id, threadId), eq(chatThread.guestSessionId, ...))) : ...,
  ...
]);
```

---

## Adding a New Query Helper — Checklist

1. Find or create `features/<domain>/server/queries.ts`
2. Add `import 'server-only'` at the top — query files never run in the browser
3. Write one `async function` per logical query. Name it after what it returns or checks: `getX`, `checkX`, `listX`
4. Return `T | null` for single-row lookups, `T[]` for multi-row, `boolean` for existence/flag checks
5. Do not throw on empty results — return `null` or `[]`
6. Do not include response logic (`Response.json`, status codes) inside the helper
7. Import `db` from `@/lib/db` and schema tables from `@/db/schema`

---

## Key Files

| File | Queries |
|------|---------|
| `features/chat/server/queries.ts` | `checkUserApproved`, `getThreadForSession`, `getUserPrefs` |
| `features/agents/server/queries.ts` | `getAgentForUser` (with ownership), `getAgentById` (bare) |
