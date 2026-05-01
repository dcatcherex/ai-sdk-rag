import { requireUser } from "@/lib/auth-server";
import { userToolWorkspaceShareMutationSchema } from "@/features/user-tools/schema";
import {
  addUserToolWorkspaceShare,
  getUserToolWorkspaceShareList,
  removeUserToolWorkspaceShare,
} from "@/features/user-tools/service";

type Params = { params: Promise<{ toolId: string }> };

export async function GET(_: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { toolId } = await params;

  try {
    const workspaceShares = await getUserToolWorkspaceShareList(toolId, authResult.user.id);
    return Response.json({ workspaceShares });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const parsed = userToolWorkspaceShareMutationSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;

  try {
    await addUserToolWorkspaceShare({
      toolId,
      ownerId: authResult.user.id,
      brandId: parsed.data.brandId,
      role: parsed.data.role,
    });
    const workspaceShares = await getUserToolWorkspaceShareList(toolId, authResult.user.id);
    return Response.json({ workspaceShares });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to share tool with workspace" },
      { status: 403 },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const parsed = userToolWorkspaceShareMutationSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;

  try {
    await removeUserToolWorkspaceShare({
      toolId,
      ownerId: authResult.user.id,
      brandId: parsed.data.brandId,
    });
    const workspaceShares = await getUserToolWorkspaceShareList(toolId, authResult.user.id);
    return Response.json({ workspaceShares });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to remove workspace share" },
      { status: 403 },
    );
  }
}
