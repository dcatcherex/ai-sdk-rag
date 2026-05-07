import { requireUser } from '@/lib/auth-server';
import { assignCase } from '@/features/case-workspace/service';
import { assignCaseInputSchema } from '@/features/case-workspace/schema';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = assignCaseInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const { caseId } = await params;
  const updatedCase = await assignCase(caseId, parsed.data, { userId: auth.user.id });
  if (!updatedCase) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  return Response.json({ case: updatedCase });
}
