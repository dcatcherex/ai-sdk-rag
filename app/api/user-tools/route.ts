import { createUserToolSchema } from "@/features/user-tools/schema";
import { createUserTool, createUserToolVersion, getUserToolsForUser } from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const tools = await getUserToolsForUser(authResult.user.id);
  return Response.json({ tools });
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createUserToolSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const tool = await createUserTool({
    userId: authResult.user.id,
    ...result.data,
  });

  if (result.data.initialVersion) {
    await createUserToolVersion({
      toolId: tool.id,
      userId: authResult.user.id,
      inputSchema: result.data.initialVersion.inputSchema,
      outputSchema: result.data.initialVersion.outputSchema,
      config: result.data.initialVersion.config,
      changeSummary: result.data.initialVersion.changeSummary,
      isDraft: result.data.initialVersion.isDraft,
      activate: result.data.initialVersion.activate,
    });
  }

  return Response.json({ tool }, { status: 201 });
}
