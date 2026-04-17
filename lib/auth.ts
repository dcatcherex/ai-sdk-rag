// ─────────────────────────────────────────────────────────────────────────────
// Auth compatibility shim (Clerk-backed).
//
// This file is preserved only to keep the existing call sites that use
//   const session = await auth.api.getSession({ headers: await headers() });
// working without a mass refactor during the Clerk migration.
//
// New code MUST import from `@/lib/auth-server` instead:
//   import { requireUser, requireAdmin, getCurrentUser } from "@/lib/auth-server";
//
// Eventually every caller should migrate and this file can be deleted.
// See: docs/clerk-migration-implementation-guide.md §12.
// ─────────────────────────────────────────────────────────────────────────────

import { eq } from "drizzle-orm";
import { auth as clerkAuth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";

type LegacySessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  approved: boolean;
};

type LegacySession = {
  user: LegacySessionUser;
  session: { userId: string };
} | null;

async function getSessionFromClerk(): Promise<LegacySession> {
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
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      emailVerified: true,
      approved: row.approved,
    },
    session: { userId: row.id },
  };
}

export const auth = {
  api: {
    getSession: async (_opts?: { headers?: Headers | Promise<Headers> }): Promise<LegacySession> => {
      return getSessionFromClerk();
    },
  },
};
