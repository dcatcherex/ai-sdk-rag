import { requireUser } from "@/lib/auth-server";
import { createStudyPlanInputSchema } from '@/features/quiz/schema';
import { runCreateStudyPlan } from '@/features/quiz/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createStudyPlanInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runCreateStudyPlan(result.data);
  return Response.json(data);
}
