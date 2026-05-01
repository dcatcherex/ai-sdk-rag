import { executeUserToolSchema } from "@/features/user-tools/schema";
import { executeUserToolById } from "@/features/user-tools/service";
import { requireUser } from "@/lib/auth-server";

type Params = { params: Promise<{ toolId: string }> };

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = executeUserToolSchema.safeParse(body);
  if (!result.success) return new Response("Bad Request", { status: 400 });

  const { toolId } = await params;
  const output = await executeUserToolById({
    toolId,
    userId: authResult.user.id,
    source: "manual",
    input: result.data.input,
    confirmed: result.data.confirmed,
  });

  return Response.json(output);
}
