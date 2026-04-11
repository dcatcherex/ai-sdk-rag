import { createAdminUserInviteSchema, listAdminUserInvitesSchema } from "@/features/admin/invites/schema";
import { createAdminUserInvite, getAdminUserInvites, AdminInviteError } from "@/features/admin/invites/service";
import { requireAdmin } from "@/lib/admin";

const serializeInvite = (invite: Awaited<ReturnType<typeof createAdminUserInvite>>) => ({
  ...invite,
  expiresAt: invite.expiresAt.toISOString(),
  acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  cancelledAt: invite.cancelledAt?.toISOString() ?? null,
  lastSentAt: invite.lastSentAt?.toISOString() ?? null,
  creditGrantedAt: invite.creditGrantedAt?.toISOString() ?? null,
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
});

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const parsed = listAdminUserInvitesSchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid query." }, { status: 400 });
  }

  const result = await getAdminUserInvites(parsed.data);

  return Response.json({
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    invites: result.invites.map(serializeInvite),
  });
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = createAdminUserInviteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid invite payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invite = await createAdminUserInvite({
      ...parsed.data,
      invitedByUserId: adminCheck.session.user.id,
      inviterName: adminCheck.session.user.name,
      requestOrigin: new URL(req.url).origin,
    });

    return Response.json({ invite: serializeInvite(invite) }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminInviteError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    throw error;
  }
}
