import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { generatedQuestionSchema } from '@/features/exam-builder/schema';
import { addQuestionsToExam } from '@/features/exam-builder/service';

const bodySchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = bodySchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const inserted = await addQuestionsToExam(id, session.user.id, result.data.questions);
  return Response.json(inserted, { status: 201 });
}
