import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { adminUserInvite, user } from "@/db/schema";

type Context = { params: Promise<{ token: string }> };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function POST(req: Request, context: Context) {
  const { token } = await context.params;

  let email: string;
  try {
    const body = await req.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);

  // Validate invite token matches email — possession of the invite link proves email ownership
  const [invite] = await db
    .select({ id: adminUserInvite.id, email: adminUserInvite.email, status: adminUserInvite.status, expiresAt: adminUserInvite.expiresAt })
    .from(adminUserInvite)
    .where(eq(adminUserInvite.token, token))
    .limit(1);

  if (
    !invite ||
    invite.status === "cancelled" ||
    invite.expiresAt <= new Date() ||
    normalizeEmail(invite.email) !== normalized
  ) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Mark email verified — only if the user row already exists (they just signed up)
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(sql`lower(${user.email}) = ${normalized}`);

  return Response.json({ ok: true });
}
