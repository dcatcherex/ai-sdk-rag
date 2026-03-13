import { listSupportAssignableUsers, requireSupportSession } from '@/lib/support';

export async function GET() {
  const access = await requireSupportSession();
  if (!access.ok) {
    return access.response;
  }

  const assignees = await listSupportAssignableUsers();
  return Response.json({ assignees });
}
