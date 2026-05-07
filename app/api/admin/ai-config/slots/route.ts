import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { getModelSlotsRow, upsertModelSlots } from '@/features/ai-config/server/service';
import { getModelSlots } from '@/lib/ai-config';

const slotSchema = z.object({
  chatModel:          z.string().min(1).nullable().optional(),
  backgroundModel:    z.string().min(1).nullable().optional(),
  optimizerModel:     z.string().min(1).nullable().optional(),
  embeddingModel:     z.string().min(1).nullable().optional(),
  imageModel:         z.string().min(1).nullable().optional(),
  videoModel:         z.string().min(1).nullable().optional(),
  audioModel:         z.string().min(1).nullable().optional(),
  ttsModel:           z.string().min(1).nullable().optional(),
  transcriptionModel: z.string().min(1).nullable().optional(),
  liveModel:          z.string().min(1).nullable().optional(),
});

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const [row, resolved] = await Promise.all([getModelSlotsRow(), getModelSlots()]);
  return Response.json({ row, resolved });
}

export async function PATCH(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = slotSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });
  }

  const updated = await upsertModelSlots(result.data, adminCheck.session.user.id);
  return Response.json(updated);
}
