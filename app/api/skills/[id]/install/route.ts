import { requireUser } from "@/lib/auth-server";
import { installSkill } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const skill = await installSkill(authResult.user.id, id);
  if (!skill) return new Response('Skill not found or not public', { status: 404 });
  return Response.json(skill, { status: 201 });
}
