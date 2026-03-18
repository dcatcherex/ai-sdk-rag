import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { generateExamQuestionsInputSchema } from '@/features/exam-builder/schema';
import { runGenerateExamQuestions } from '@/features/exam-builder/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = generateExamQuestionsInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runGenerateExamQuestions(result.data);
  return Response.json(data);
}
