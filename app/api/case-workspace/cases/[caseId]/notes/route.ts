import { requireUser } from '@/lib/auth-server';
import { addCaseNote } from '@/features/case-workspace/service';
import { createTimelineNoteInputSchema } from '@/features/case-workspace/schema';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createTimelineNoteInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const { caseId } = await params;
  const note = await addCaseNote(caseId, parsed.data, { userId: auth.user.id });
  return Response.json({ note }, { status: 201 });
}
