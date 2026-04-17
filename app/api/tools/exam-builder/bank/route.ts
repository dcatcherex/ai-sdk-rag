import { requireUser } from "@/lib/auth-server";
import { bankFilterSchema } from '@/features/exam-builder/schema';
import { getUserBankQuestions } from '@/features/exam-builder/service';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const raw = {
    subject: searchParams.get('subject') ?? undefined,
    gradeLevel: searchParams.get('gradeLevel') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    bloomsLevel: searchParams.get('bloomsLevel') ?? undefined,
  };

  const filters = bankFilterSchema.safeParse(raw);
  const questions = await getUserBankQuestions(
    authResult.user.id,
    filters.success ? filters.data : undefined,
  );

  return Response.json(questions);
}
