import { requireUser } from '@/lib/auth-server';
import { getCaseContext, updateCase } from '@/features/case-workspace/service';
import { updateCaseInputSchema } from '@/features/case-workspace/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { caseId } = await params;
  const context = await getCaseContext(caseId, { userId: auth.user.id });
  return Response.json({ context });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = updateCaseInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const { caseId } = await params;
  const updatedCase = await updateCase(caseId, parsed.data, { userId: auth.user.id });
  if (!updatedCase) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  return Response.json({ case: updatedCase });
}
