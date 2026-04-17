import { eq } from "drizzle-orm";

import { user } from "@/db/schema";
import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;


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
      .where(eq(user.id, authResult.user.id))
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
