import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { account, user as userTable } from "@/db/schema";
import { getAdminUserInviteByToken } from "@/features/admin/invites/service";
import { generateServerMagicLink } from "@/lib/server/magic-link";

type Context = { params: Promise<{ token: string }> };

export async function GET(_req: Request, context: Context) {
  const { token } = await context.params;
  const inviteHref = `/invite/${token}`;
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  const invite = await getAdminUserInviteByToken(token);
  const signInHref = invite
    ? `/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`
    : `/sign-in?next=${encodeURIComponent(inviteHref)}`;
  if (!invite) {
    return NextResponse.redirect(new URL(signInHref, baseUrl));
  }

  const [invitedUser] = await db
    .select({ id: userTable.id, email: userTable.email })
    .from(userTable)
    .where(sql`lower(${userTable.email}) = ${invite.email.trim().toLowerCase()}`)
    .limit(1);

  if (!invitedUser) {
    return NextResponse.redirect(
      new URL(`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`, baseUrl),
    );
  }

  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, invitedUser.id), eq(account.providerId, "credential")))
    .limit(1);

  if (credentialAccount) {
    return NextResponse.redirect(
      new URL(`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`, baseUrl),
    );
  }

  const magicLinkPath = await generateServerMagicLink(invite.email, inviteHref, signInHref);
  return NextResponse.redirect(new URL(magicLinkPath, baseUrl));
}
