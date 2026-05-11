import { requireAdmin } from '@/lib/admin';
import { hasRichMessageTemplate } from '@/features/rich-messages/registry';
import {
  deleteDbRichMessageTemplate,
  getDbRichMessageTemplateById,
  getDbRichMessageTemplateByKey,
  updateDbRichMessageTemplate,
} from '@/features/rich-messages/server/repository';
import {
  toDbRichMessageTemplateCatalogEntry,
  updateDbRichMessageTemplateSchema,
} from '@/features/rich-messages/server/service';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { id } = await params;
  const existing = await getDbRichMessageTemplateById(id);
  if (!existing) {
    return new Response('Not Found', { status: 404 });
  }

  const body = await req.json();
  const result = updateDbRichMessageTemplateSchema.safeParse(body);
  if (!result.success) {
    return new Response('Bad Request', { status: 400 });
  }

  if (result.data.key && result.data.key !== existing.key) {
    if (hasRichMessageTemplate(result.data.key)) {
      return new Response('Template key already exists', { status: 409 });
    }

    const conflict = await getDbRichMessageTemplateByKey(result.data.key);
    if (conflict && conflict.id !== id) {
      return new Response('Template key already exists', { status: 409 });
    }
  }

  const updated = await updateDbRichMessageTemplate(id, result.data);
  if (!updated) {
    return new Response('Not Found', { status: 404 });
  }

  return Response.json({ template: toDbRichMessageTemplateCatalogEntry(updated) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { id } = await params;
  await deleteDbRichMessageTemplate(id);
  return Response.json({ ok: true });
}
