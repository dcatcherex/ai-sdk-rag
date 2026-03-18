import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { generatePracticeQuizInputSchema } from '@/features/quiz/schema';
import { runGeneratePracticeQuiz } from '@/features/quiz/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = generatePracticeQuizInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runGeneratePracticeQuiz(result.data);
  return Response.json(data);
}
