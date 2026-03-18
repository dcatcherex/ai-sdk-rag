import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { updateExamDraftInputSchema } from '@/features/exam-builder/schema';
import { getExamDraft, updateExamDraft, deleteExamDraft } from '@/features/exam-builder/service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  void req;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const exam = await getExamDraft(id, session.user.id);
  if (!exam) return new Response('Not Found', { status: 404 });

  return Response.json(exam);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = updateExamDraftInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const updated = await updateExamDraft(id, session.user.id, result.data);
  if (!updated) return new Response('Not Found', { status: 404 });

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: Params) {
  void req;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  await deleteExamDraft(id, session.user.id);
  return new Response(null, { status: 204 });
}
