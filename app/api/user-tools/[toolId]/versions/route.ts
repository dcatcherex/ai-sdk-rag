import { createUserToolVersionSchema } from "@/features/user-tools/schema";
import { createUserToolVersion } from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";

type Params = { params: Promise<{ toolId: string }> };

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createUserToolVersionSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;
  const versionId = await createUserToolVersion({
    toolId,
    userId: authResult.user.id,
    inputSchema: result.data.inputSchema,
    outputSchema: result.data.outputSchema,
    config: result.data.config,
    changeSummary: result.data.changeSummary,
    isDraft: result.data.isDraft,
    activate: result.data.activate,
  });

  return Response.json({ versionId }, { status: 201 });
}
