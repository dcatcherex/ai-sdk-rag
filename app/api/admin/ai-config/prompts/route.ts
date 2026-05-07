import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import {
  listPromptTemplates,
  createPromptVersion,
} from '@/features/ai-config/server/service';

const createVersionSchema = z.object({
  key: z.string().min(1).max(128),
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
  content: z.string().min(1),
  note: z.string().max(512).optional(),
});

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const templates = await listPromptTemplates();
  return Response.json(templates);
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = createVersionSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  const { template, version } = await createPromptVersion({
    ...result.data,
    createdBy: adminCheck.session.user.id,
  });
  return Response.json({ template, version }, { status: 201 });
}
