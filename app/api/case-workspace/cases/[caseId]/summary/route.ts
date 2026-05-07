import { requireUser } from '@/lib/auth-server';
import { summarizeCase } from '@/features/case-workspace/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { caseId } = await params;
  const summary = await summarizeCase(caseId, { userId: auth.user.id });
  return Response.json({ summary });
}
