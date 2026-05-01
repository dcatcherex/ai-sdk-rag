import { canViewUserTool } from "@/features/user-tools/server/permissions";
import { getUserToolById, getUserToolRuns } from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";

type Params = { params: Promise<{ toolId: string }> };

export async function GET(_: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { toolId } = await params;
  const row = await getUserToolById(toolId, authResult.user.id);
  if (!row || !canViewUserTool({ userId: authResult.user.id, tool: row.tool, shareRole: row.shareRole })) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await getUserToolRuns(toolId, authResult.user.id);
  return Response.json({ runs });
}
