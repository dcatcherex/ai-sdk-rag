import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/platform-settings';
import { availableModels } from '@/lib/ai';

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const settings = await getPlatformSettings();
  const adminEnabledModelIds = settings.adminEnabledModelIds ?? availableModels.map((m) => m.id);

  return Response.json({ adminEnabledModelIds });
}

const putSchema = z.object({
  adminEnabledModelIds: z.array(z.string()).min(1),
});

export async function PUT(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = putSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  const validIds = result.data.adminEnabledModelIds.filter((id) =>
    availableModels.some((m) => m.id === id)
  );

  if (validIds.length === 0) {
    return Response.json({ error: 'At least one model must be enabled' }, { status: 400 });
  }

  await updatePlatformSettings({ adminEnabledModelIds: validIds });
  return Response.json({ adminEnabledModelIds: validIds });
}
