import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { updateExamQuestionInputSchema } from '@/features/exam-builder/schema';
import { updateExamQuestion, deleteExamQuestion } from '@/features/exam-builder/service';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = updateExamQuestionInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateExamQuestion(id, session.user.id, result.data);
  if (!updated) return new Response('Not Found', { status: 404 });

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: Params) {
  void req;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  await deleteExamQuestion(id, session.user.id);
  return new Response(null, { status: 204 });
}
