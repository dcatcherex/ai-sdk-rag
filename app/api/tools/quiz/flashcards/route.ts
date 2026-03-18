import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { generateFlashcardsInputSchema } from '@/features/quiz/schema';
import { runGenerateFlashcards } from '@/features/quiz/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = generateFlashcardsInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runGenerateFlashcards(result.data);
  return Response.json(data);
}
