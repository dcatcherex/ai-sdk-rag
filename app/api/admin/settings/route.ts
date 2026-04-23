import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/platform-settings';

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const settings = await getPlatformSettings();
  return Response.json(settings);
}

const patchSchema = z.object({
  guestAccessEnabled: z.boolean().optional(),
  guestStartingCredits: z.number().int().min(0).max(10000).optional(),
  guestSessionTtlDays: z.number().int().min(1).max(365).optional(),
  signupBonusCredits: z.number().int().min(0).max(100000).optional(),
  requireEmailVerification: z.boolean().optional(),
  guestStarterAgentId: z.string().min(1).nullable().optional(),
  newUserStarterTemplateId: z.string().min(1).nullable().optional(),
  instantStockEnabled: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  const updated = await updatePlatformSettings(result.data);
  return Response.json(updated);
}
