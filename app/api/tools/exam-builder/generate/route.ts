import { requireUser } from "@/lib/auth-server";
import { generateExamQuestionsInputSchema } from '@/features/exam-builder/schema';
import { runGenerateExamQuestions } from '@/features/exam-builder/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = generateExamQuestionsInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runGenerateExamQuestions(result.data);
  return Response.json(data);
}
