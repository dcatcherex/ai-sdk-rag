import { requireAdmin } from '@/lib/admin';

type Params = { params: Promise<{ id: string }> };

// Admin-managed template agents do not support user-created tool attachments.
// This route exists so the AgentForm component (which shares the route prefix
// for both skills and user-tools) does not receive a 404 when loaded in the
// admin context.

export async function GET(_req: Request, _ctx: Params) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;
  return Response.json({ attachments: [] });
}

export async function PUT(_req: Request, _ctx: Params) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;
  return Response.json({ attachments: [] });
}
