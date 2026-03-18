import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { exportExamInputSchema } from '@/features/exam-builder/schema';
import { getExamDraft, generateExamHtml, generateAnswerKeyHtml } from '@/features/exam-builder/service';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = exportExamInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const exam = await getExamDraft(id, session.user.id);
  if (!exam) return new Response('Not Found', { status: 404 });
  if (exam.questions.length === 0) return new Response('Exam has no questions', { status: 400 });

  const examHtml = generateExamHtml(exam, result.data);
  const answerKeyHtml = generateAnswerKeyHtml(exam);

  return Response.json({ examHtml, answerKeyHtml });
}
