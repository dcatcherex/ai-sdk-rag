import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { imageModelConfig } from '@/db/schema/admin';
import { triggerImageGeneration } from '@/features/image/service';

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  styleTag: z.string().optional(),
  aspectRatio: z.string().optional(),
  count: z.number().int().min(1).max(10),
  modelId: z.string().optional(),
});

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = generateSchema.safeParse(body);
  if (!result.success) return Response.json({ error: 'Invalid request', issues: result.error.issues }, { status: 400 });

  const { prompt, styleTag, aspectRatio, count, modelId: requestedModelId } = result.data;

  // Resolve model — explicit override or global default
  let modelId = requestedModelId;
  if (!modelId) {
    const [defaultModel] = await db
      .select({ id: imageModelConfig.id })
      .from(imageModelConfig)
      .where(eq(imageModelConfig.isDefault, true))
      .limit(1);
    modelId = defaultModel?.id ?? 'gpt-image/1.5-text-to-image';
  }

  const userId = adminCheck.session.user.id;

  const jobs = await Promise.allSettled(
    Array.from({ length: count }).map(() =>
      triggerImageGeneration(
        { prompt, modelId: modelId!, aspectRatio, taskHint: styleTag, promptTitle: prompt.substring(0, 50) },
        userId,
        { source: 'admin-stock' },
      ),
    ),
  );

  const started = jobs.filter(j => j.status === 'fulfilled').length;
  const failed = jobs.filter(j => j.status === 'rejected').length;

  return Response.json({ started, failed });
}
