import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account } from "@/db/schema";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If user already has a credential account, no setup needed
  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
    .limit(1);

  if (credentialAccount) {
    return Response.json({ redirectUrl: "/" });
  }

  return Response.json({ redirectUrl: "/setup-password?invite=accepted" });
}
