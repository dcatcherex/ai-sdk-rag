import { requireAdmin } from '@/lib/admin';
import {
  getDbRichMessageTemplateById,
  setDbRichMessageTemplateStatus,
} from '@/features/rich-messages/server/repository';
import { toDbRichMessageTemplateCatalogEntry } from '@/features/rich-messages/server/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { id } = await params;
  const existing = await getDbRichMessageTemplateById(id);
  if (!existing) {
    return new Response('Not Found', { status: 404 });
  }

  const updated = await setDbRichMessageTemplateStatus(id, 'published');
  if (!updated) {
    return new Response('Not Found', { status: 404 });
  }

  return Response.json({ template: toDbRichMessageTemplateCatalogEntry(updated) });
}
