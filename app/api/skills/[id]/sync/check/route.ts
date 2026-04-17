import { requireUser } from "@/lib/auth-server";
import { checkSkillSync } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  try {
    const result = await checkSkillSync(authResult.user.id, id);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Skill not found' ? 404 : 400;
    return new Response(message, { status });
  }
}
