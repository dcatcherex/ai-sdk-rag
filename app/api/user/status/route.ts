import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows, settings] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        approved: user.approved,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    getPlatformSettings(),
  ]);

  const currentUser = rows[0];

  if (!currentUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    approved: currentUser.approved,
    emailVerified: currentUser.emailVerified,
    requireEmailVerification: settings.requireEmailVerification,
  });
}
