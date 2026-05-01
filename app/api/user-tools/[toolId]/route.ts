import { canEditUserTool, canViewUserTool } from "@/features/user-tools/server/permissions";
import { updateUserToolSchema } from "@/features/user-tools/schema";
import {
  getUserToolActiveVersion,
  getUserToolById,
  getUserToolShareList,
  getUserToolWorkspaceShareList,
  getUserToolVersions,
  updateUserTool,
} from "@/features/user-tools/service";
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

  const [activeVersion, versions] = await Promise.all([
    getUserToolActiveVersion(row.tool.id, row.tool.activeVersion),
    getUserToolVersions(row.tool.id),
  ]);

  const isOwner = row.tool.userId === authResult.user.id;
  const [sharedWith, workspaceShares] = isOwner
    ? await Promise.all([
        getUserToolShareList(row.tool.id, authResult.user.id),
        getUserToolWorkspaceShareList(row.tool.id, authResult.user.id),
      ])
    : [[], []];

  return Response.json({
    tool: row.tool,
    shareRole: row.shareRole,
    isOwner,
    sharedWith,
    workspaceShares,
    activeVersion,
    versions,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = updateUserToolSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;
  const existing = await getUserToolById(toolId, authResult.user.id);
  if (!existing || !canEditUserTool({ userId: authResult.user.id, tool: existing.tool, shareRole: existing.shareRole })) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const updated = await updateUserTool(toolId, result.data, authResult.user.id);
  return Response.json({ tool: updated?.tool ?? null, shareRole: updated?.shareRole ?? null });
}
