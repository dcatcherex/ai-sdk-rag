import { requireUser } from "@/lib/auth-server";
import { userToolShareMutationSchema } from "@/features/user-tools/schema";
import { addUserToolShare, getUserToolShareList, removeUserToolShare } from "@/features/user-tools/service";

type Params = { params: Promise<{ toolId: string }> };

export async function GET(_: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { toolId } = await params;

  try {
    const shares = await getUserToolShareList(toolId, authResult.user.id);
    return Response.json({ shares });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = userToolShareMutationSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;

  try {
    await addUserToolShare({
      toolId,
      ownerId: authResult.user.id,
      targetUserId: result.data.userId,
      role: result.data.role,
    });
    const shares = await getUserToolShareList(toolId, authResult.user.id);
    return Response.json({ shares });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to share tool" },
      { status: 403 },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = userToolShareMutationSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;

  try {
    await removeUserToolShare({
      toolId,
      ownerId: authResult.user.id,
      targetUserId: result.data.userId,
    });
    const shares = await getUserToolShareList(toolId, authResult.user.id);
    return Response.json({ shares });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to remove share" },
      { status: 403 },
    );
  }
}
