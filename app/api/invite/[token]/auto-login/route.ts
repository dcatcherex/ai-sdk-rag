import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { account, session, user as userTable } from "@/db/schema";
import { getAdminUserInviteByToken } from "@/features/admin/invites/service";

type Context = { params: Promise<{ token: string }> };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(_req: Request, context: Context) {
  const { token } = await context.params;
  const inviteHref = `/invite/${token}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(inviteHref)}`;

  // Validate invite
  const invite = await getAdminUserInviteByToken(token);
  if (!invite) {
    return NextResponse.redirect(new URL(signInHref, process.env.BETTER_AUTH_URL ?? "http://localhost:3000"));
  }

  // Find the invited user
  const [invitedUser] = await db
    .select({ id: userTable.id, email: userTable.email })
    .from(userTable)
    .where(sql`lower(${userTable.email}) = ${invite.email.trim().toLowerCase()}`)
    .limit(1);

  if (!invitedUser) {
    // No account yet — go to sign-in/register
    return NextResponse.redirect(
      new URL(`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`, process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
    );
  }

  // Only auto-login passwordless users (no credential account)
  const [credAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, invitedUser.id), eq(account.providerId, "credential")))
    .limit(1);

  if (credAccount) {
    // Has a password — send to normal sign-in
    return NextResponse.redirect(
      new URL(`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`, process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
    );
  }

  // Create a session directly — no rate-limited magic link endpoint needed
  const sessionToken = nanoid(64);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS);

  await db.insert(session).values({
    id: nanoid(),
    token: sessionToken,
    userId: invitedUser.id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const isHttps = baseUrl.startsWith("https://");
  const cookieName = isHttps ? "__Secure-better-auth.session_token" : "better-auth.session_token";

  const cookieAttributes = [
    `${cookieName}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${THIRTY_DAYS_MS / 1000}`,
    ...(isHttps ? ["Secure"] : []),
  ].join("; ");

  const response = NextResponse.redirect(new URL(inviteHref, baseUrl));
  response.headers.set("Set-Cookie", cookieAttributes);
  return response;
}
