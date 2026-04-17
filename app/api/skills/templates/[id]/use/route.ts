
import { requireUser } from "@/lib/auth-server";
import { usePublishedSkillTemplate } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const skill = await usePublishedSkillTemplate(authResult.user.id, id);
  if (!skill) return new Response('Skill template not found', { status: 404 });

  return Response.json(skill, { status: 201 });
}
