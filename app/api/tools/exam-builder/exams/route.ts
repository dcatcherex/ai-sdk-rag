import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { createExamDraftInputSchema } from '@/features/exam-builder/schema';
import { createExamDraft, getUserExams } from '@/features/exam-builder/service';

export async function GET(req: Request) {
  void req;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const exams = await getUserExams(session.user.id);
  return Response.json(exams);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = createExamDraftInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const exam = await createExamDraft(session.user.id, result.data);
  return Response.json(exam, { status: 201 });
}
