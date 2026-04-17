import "server-only";

import { eq } from "drizzle-orm";
import { auth as clerkAuth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin-emails";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  approved: boolean;
};

/**
 * Returns the current user (from Clerk session + our user table) or null.
 * Use in optional-auth contexts.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await clerkAuth();
  if (!userId) return null;

  const rows = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    approved: row.approved,
  };
}

/**
 * Returns the current user or a 401 Response. Use in API routes that require
 * authentication.
 *
 * Usage:
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 *   const userId = auth.user.id;
 */
export async function requireUser(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: Response }
> {
  const u = await getCurrentUser();
  if (!u) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, user: u };
}

/**
 * Returns the current user if admin, or a 401/403 Response.
 */
export async function requireAdmin(): Promise<
  | { ok: true; user: AppUser }
  | { ok: false; response: Response }
> {
  const authed = await requireUser();
  if (!authed.ok) return authed;
  if (!isAdminEmail(authed.user.email)) {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden: admin only" }, { status: 403 }),
    };
  }
  return authed;
}

export { clerkClient, currentUser };
