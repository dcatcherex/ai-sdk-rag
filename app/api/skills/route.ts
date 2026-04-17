import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { createSkill, getSkillCatalog } from '@/features/skills/service';

const createSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().max(64).nullable().optional(),
  description: z.string().min(1).max(1024),
  activationMode: z.enum(['rule', 'model']).optional(),
  triggerType: z.enum(['slash', 'keyword', 'always']).optional(),
  trigger: z.string().max(100).nullable().optional(),
  promptFragment: z.string().min(1),
  enabledTools: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  skillKind: z.enum(['inline', 'package']).optional(),
  license: z.string().max(300).optional(),
  compatibility: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  files: z.array(z.object({
    relativePath: z.string().min(1).max(300),
    textContent: z.string(),
  })).optional(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const catalog = await getSkillCatalog(authResult.user.id);
  return Response.json(catalog);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const skill = await createSkill(authResult.user.id, result.data);
  return Response.json(skill, { status: 201 });
}
