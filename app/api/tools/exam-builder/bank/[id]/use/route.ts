import { requireUser } from "@/lib/auth-server";
import { z } from 'zod';
import { addBankQuestionToExam } from '@/features/exam-builder/service';

const bodySchema = z.object({ examId: z.string().min(1) });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = bodySchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { id } = await params;
  const question = await addBankQuestionToExam(id, result.data.examId, authResult.user.id);
  if (!question) return new Response('Not Found', { status: 404 });

  return Response.json(question, { status: 201 });
}
