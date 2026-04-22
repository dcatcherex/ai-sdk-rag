import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { imageModelConfig } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { KIE_IMAGE_MODELS } from '@/lib/models/kie-image';

// GET /api/admin/image-models
// Returns all models from the registry merged with their DB config.
// Models not yet in DB are returned with default values (enabled: true).
export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const configs = await db.select().from(imageModelConfig);
  const configMap = new Map(configs.map(c => [c.id, c]));

  const models = KIE_IMAGE_MODELS.map(m => {
    const cfg = configMap.get(m.id);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      provider: m.imageOptions?.iconProvider ?? m.provider,
      mode: m.imageOptions?.mode ?? 'generate',
      badge: m.imageOptions?.badge,
      costPerGeneration: m.costPerGeneration,
      hasQuality: m.imageOptions?.hasQuality ?? false,
      hasEnablePro: m.imageOptions?.hasEnablePro ?? false,
      hasResolution: m.imageOptions?.hasResolution ?? false,
      hasGoogleSearch: m.imageOptions?.hasGoogleSearch ?? false,
      hasSeed: m.imageOptions?.hasSeed ?? false,
      aspectRatios: m.imageOptions?.aspectRatios ?? [],
      pricingTiers: m.imageOptions?.pricingTiers,
      // DB config (defaults if not configured yet)
      enabled: cfg?.enabled ?? true,
      isDefault: cfg?.isDefault ?? false,
      defaultAspectRatio: cfg?.defaultAspectRatio ?? null,
      defaultQuality: cfg?.defaultQuality ?? null,
      defaultResolution: cfg?.defaultResolution ?? null,
      defaultEnablePro: cfg?.defaultEnablePro ?? false,
      defaultGoogleSearch: cfg?.defaultGoogleSearch ?? false,
      taskDefaults: cfg?.taskDefaults ?? [],
      adminNotes: cfg?.adminNotes ?? null,
      updatedAt: cfg?.updatedAt ?? null,
    };
  });

  return Response.json({ models });
}

// PATCH /api/admin/image-models
// Upserts config for a model. Sends only the fields to change.
export async function PATCH(req: Request) {
  try {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json() as {
    id: string;
    enabled?: boolean;
    isDefault?: boolean;
    defaultAspectRatio?: string | null;
    defaultQuality?: string | null;
    defaultResolution?: string | null;
    defaultEnablePro?: boolean;
    defaultGoogleSearch?: boolean;
    taskDefaults?: string[];
    adminNotes?: string | null;
  };

  if (!body.id || typeof body.id !== 'string') {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  // Validate id exists in registry
  const exists = KIE_IMAGE_MODELS.some(m => m.id === body.id);
  if (!exists) {
    return Response.json({ error: 'Unknown model id' }, { status: 400 });
  }

  // If setting as global default, clear it from all other models first
  if (body.isDefault === true) {
    await db.update(imageModelConfig).set({ isDefault: false }).where(eq(imageModelConfig.isDefault, true));
  }

  // For each task being assigned, remove it from any other model that currently holds it
  if (body.taskDefaults && body.taskDefaults.length > 0) {
    for (const task of body.taskDefaults) {
      await db.execute(sql`
        UPDATE image_model_config
        SET task_defaults = array_remove(task_defaults, ${task})
        WHERE id != ${body.id} AND ${task} = ANY(task_defaults)
      `);
    }
  }

  // Upsert the config row
  const existing = await db
    .select()
    .from(imageModelConfig)
    .where(eq(imageModelConfig.id, body.id))
    .limit(1);

  const updateData: Partial<typeof imageModelConfig.$inferInsert> = {};
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
  if ('defaultAspectRatio' in body) updateData.defaultAspectRatio = body.defaultAspectRatio ?? undefined;
  if ('defaultQuality' in body) updateData.defaultQuality = body.defaultQuality ?? undefined;
  if ('defaultResolution' in body) updateData.defaultResolution = body.defaultResolution ?? undefined;
  if (body.defaultEnablePro !== undefined) updateData.defaultEnablePro = body.defaultEnablePro;
  if (body.defaultGoogleSearch !== undefined) updateData.defaultGoogleSearch = body.defaultGoogleSearch;
  if (body.taskDefaults !== undefined) updateData.taskDefaults = body.taskDefaults;
  if ('adminNotes' in body) updateData.adminNotes = body.adminNotes ?? undefined;

  if (existing.length > 0) {
    await db
      .update(imageModelConfig)
      .set(updateData)
      .where(eq(imageModelConfig.id, body.id));
  } else {
    await db.insert(imageModelConfig).values({
      id: body.id,
      enabled: body.enabled ?? true,
      isDefault: body.isDefault ?? false,
      defaultAspectRatio: body.defaultAspectRatio ?? undefined,
      defaultQuality: body.defaultQuality ?? undefined,
      defaultResolution: body.defaultResolution ?? undefined,
      defaultEnablePro: body.defaultEnablePro ?? false,
      defaultGoogleSearch: body.defaultGoogleSearch ?? false,
      taskDefaults: body.taskDefaults ?? [],
      adminNotes: body.adminNotes ?? undefined,
      updatedAt: new Date(),
    });
  }

  return Response.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/admin/image-models]', err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
