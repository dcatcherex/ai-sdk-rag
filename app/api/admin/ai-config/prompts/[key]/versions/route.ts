import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import {
  getPromptTemplateByKey,
  listPromptVersions,
  createPromptVersion,
  rollbackPromptToVersion,
} from '@/features/ai-config/server/service';

const createVersionSchema = z.object({
  content: z.string().min(1),
  note: z.string().max(512).optional(),
});

const rollbackSchema = z.object({
  versionId: z.string().min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { key } = await params;
  const template = await getPromptTemplateByKey(key);
  if (!template) return Response.json({ error: 'Not found' }, { status: 404 });

  const versions = await listPromptVersions(template.id);
  return Response.json({ template, versions });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { key } = await params;
  const body = await req.json();
  const result = createVersionSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  const { template, version } = await createPromptVersion({
    key,
    content: result.data.content,
    note: result.data.note,
    createdBy: adminCheck.session.user.id,
  });
  return Response.json({ template, version }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { key } = await params;
  const template = await getPromptTemplateByKey(key);
  if (!template) return Response.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const result = rollbackSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  try {
    await rollbackPromptToVersion(template.id, result.data.versionId);
  } catch {
    return Response.json({ error: 'Version does not belong to this template' }, { status: 400 });
  }
  return Response.json({ ok: true });
}
