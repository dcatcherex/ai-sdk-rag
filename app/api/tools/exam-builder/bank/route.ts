import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { bankFilterSchema } from '@/features/exam-builder/schema';
import { getUserBankQuestions } from '@/features/exam-builder/service';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = {
    subject: searchParams.get('subject') ?? undefined,
    gradeLevel: searchParams.get('gradeLevel') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    bloomsLevel: searchParams.get('bloomsLevel') ?? undefined,
  };

  const filters = bankFilterSchema.safeParse(raw);
  const questions = await getUserBankQuestions(
    session.user.id,
    filters.success ? filters.data : undefined,
  );

  return Response.json(questions);
}
