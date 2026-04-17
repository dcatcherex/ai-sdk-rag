import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { importSkillFromUrl } from '@/features/skills/service';

const importSchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = importSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request: provide a valid URL', { status: 400 });

  const { url } = result.data;

  // Only allow GitHub URLs for security
  if (!url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    return new Response('Only GitHub URLs are supported', { status: 400 });
  }

  try {
    const skill = await importSkillFromUrl(authResult.user.id, url);
    return Response.json(skill, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return new Response(message, { status: 422 });
  }
}
