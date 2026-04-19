import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { importSkillFromUrl, importSkillFromLocalPath } from '@/features/skills/service';

const importSchema = z.object({
  url: z.string().min(1),
});

function isHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isGitHubUrl(input: string): boolean {
  return input.includes('github.com') || input.includes('raw.githubusercontent.com');
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = importSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request: provide a URL or local path', { status: 400 });

  const { url: input } = result.data;

  try {
    if (isHttpUrl(input)) {
      if (!isGitHubUrl(input)) {
        return new Response('Only GitHub URLs are supported', { status: 400 });
      }
      const skill = await importSkillFromUrl(authResult.user.id, input);
      return Response.json(skill, { status: 201 });
    }

    // Local path — only allowed outside production
    if (process.env.NODE_ENV === 'production') {
      return new Response('Local path imports are not allowed in production', { status: 403 });
    }

    const skill = await importSkillFromLocalPath(authResult.user.id, input);
    return Response.json(skill, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return new Response(message, { status: 422 });
  }
}
