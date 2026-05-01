import { getUserToolShareableWorkspaces } from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const workspaces = await getUserToolShareableWorkspaces(authResult.user.id);
  return Response.json({ workspaces });
}
