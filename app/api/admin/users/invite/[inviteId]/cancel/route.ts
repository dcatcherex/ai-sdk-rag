import { cancelAdminUserInvite, AdminInviteError } from "@/features/admin/invites/service";
import { requireAdmin } from "@/lib/admin";

type Context = { params: Promise<{ inviteId: string }> };

const serializeInvite = (invite: Awaited<ReturnType<typeof cancelAdminUserInvite>>) => ({
  ...invite,
  expiresAt: invite.expiresAt.toISOString(),
  acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  cancelledAt: invite.cancelledAt?.toISOString() ?? null,
  lastSentAt: invite.lastSentAt?.toISOString() ?? null,
  creditGrantedAt: invite.creditGrantedAt?.toISOString() ?? null,
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
});

export async function POST(_req: Request, context: Context) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { inviteId } = await context.params;

  try {
    const invite = await cancelAdminUserInvite(inviteId);
    return Response.json({ invite: serializeInvite(invite) });
  } catch (error) {
    if (error instanceof AdminInviteError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}
