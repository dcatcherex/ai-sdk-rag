import { requireUser } from "@/lib/auth-server";
import { createExamDraftInputSchema } from '@/features/exam-builder/schema';
import { createExamDraft, getUserExams } from '@/features/exam-builder/service';

export async function GET(req: Request) {
  void req;
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const exams = await getUserExams(authResult.user.id);
  return Response.json(exams);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createExamDraftInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const exam = await createExamDraft(authResult.user.id, result.data);
  return Response.json(exam, { status: 201 });
}
