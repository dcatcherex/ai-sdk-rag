import { resendAdminUserInvite, AdminInviteError } from "@/features/admin/invites/service";
import { requireAdmin } from "@/lib/admin";

type Context = { params: Promise<{ inviteId: string }> };

const serializeInvite = (invite: Awaited<ReturnType<typeof resendAdminUserInvite>>) => ({
  ...invite,
  expiresAt: invite.expiresAt.toISOString(),
  acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  cancelledAt: invite.cancelledAt?.toISOString() ?? null,
  lastSentAt: invite.lastSentAt?.toISOString() ?? null,
  creditGrantedAt: invite.creditGrantedAt?.toISOString() ?? null,
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
});

export async function POST(req: Request, context: Context) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { inviteId } = await context.params;

  try {
    const invite = await resendAdminUserInvite({
      inviteId,
      inviterName: adminCheck.session.user.name,
      requestOrigin: new URL(req.url).origin,
    });

    return Response.json({ invite: serializeInvite(invite) });
  } catch (error) {
    if (error instanceof AdminInviteError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}
