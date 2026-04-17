import { requireUser } from "@/lib/auth-server";
import { repurposeContent } from '@/features/repurposing/service';
import { repurposeInputSchema } from '@/features/repurposing/schema';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = repurposeInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const pieces = await repurposeContent(authResult.user.id, result.data);
  return Response.json(pieces, { status: 201 });
}
