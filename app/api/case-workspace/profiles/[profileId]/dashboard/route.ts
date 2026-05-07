import { requireUser } from '@/lib/auth-server';
import { getCaseWorkspaceDashboard } from '@/features/case-workspace/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { profileId } = await params;
  const dashboard = await getCaseWorkspaceDashboard(profileId, { userId: auth.user.id });
  return Response.json({ dashboard });
}
