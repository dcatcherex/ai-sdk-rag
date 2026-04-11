import { headers } from "next/headers";

import { claimAdminUserInvite, AdminInviteError } from "@/features/admin/invites/service";
import { auth } from "@/lib/auth";

type Context = { params: Promise<{ token: string }> };

export async function POST(_req: Request, context: Context) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await context.params;

  try {
    const result = await claimAdminUserInvite({
      token,
      userId: session.user.id,
      userEmail: session.user.email,
    });

    return Response.json({
      alreadyAccepted: result.alreadyAccepted,
      invite: {
        ...result.invite,
        expiresAt: result.invite.expiresAt.toISOString(),
        acceptedAt: result.invite.acceptedAt?.toISOString() ?? null,
        cancelledAt: result.invite.cancelledAt?.toISOString() ?? null,
        lastSentAt: result.invite.lastSentAt?.toISOString() ?? null,
        creditGrantedAt: result.invite.creditGrantedAt?.toISOString() ?? null,
        createdAt: result.invite.createdAt.toISOString(),
        updatedAt: result.invite.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AdminInviteError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}
