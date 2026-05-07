import { and, eq, desc, max, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { aiModelSlots, promptTemplate, promptTemplateVersion } from '@/db/schema';
import { invalidateAIConfigCache } from '@/lib/ai-config';
import type { AiModelSlotsRow, PromptTemplateRow, PromptTemplateVersionRow } from '@/db/schema';

// ── Model Slots ───────────────────────────────────────────────────────────────

export type UpdateModelSlotsInput = Partial<Omit<AiModelSlotsRow, 'id' | 'updatedAt'>>;

type LegacyAiModelSlotsRow = Omit<AiModelSlotsRow, 'optimizerModel'>;

function isMissingOptimizerColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
  const causeCode = cause && typeof cause === 'object' && 'code' in cause
    ? (cause as { code?: unknown }).code
    : undefined;

  return code === '42703' || causeCode === '42703';
}

function normalizeLegacySlotsRow(row: LegacyAiModelSlotsRow | undefined | null): AiModelSlotsRow | null {
  if (!row) return null;

  return {
    ...row,
    optimizerModel: null,
  };
}

async function getLegacyModelSlotsRow(): Promise<AiModelSlotsRow | null> {
  const result = await db.execute(sql`
    SELECT
      id,
      chat_model AS "chatModel",
      background_model AS "backgroundModel",
      embedding_model AS "embeddingModel",
      image_model AS "imageModel",
      video_model AS "videoModel",
      audio_model AS "audioModel",
      tts_model AS "ttsModel",
      transcription_model AS "transcriptionModel",
      live_model AS "liveModel",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    FROM ai_model_slots
    WHERE id = 1
    LIMIT 1
  `);

  return normalizeLegacySlotsRow((result.rows as LegacyAiModelSlotsRow[])[0] ?? null);
}

export async function upsertModelSlots(
  data: UpdateModelSlotsInput,
  updatedBy: string,
): Promise<AiModelSlotsRow> {
  const payload = { id: 1, ...data, updatedBy, updatedAt: new Date() };

  try {
    const [row] = await db
      .insert(aiModelSlots)
      .values(payload)
      .onConflictDoUpdate({
        target: aiModelSlots.id,
        set: { ...data, updatedBy, updatedAt: new Date() },
      })
      .returning();

    invalidateAIConfigCache('slots');
    return row!;
  } catch (error) {
    if (!isMissingOptimizerColumnError(error)) {
      throw error;
    }

    const result = await db.execute(sql`
      INSERT INTO ai_model_slots (
        id,
        chat_model,
        background_model,
        embedding_model,
        image_model,
        video_model,
        audio_model,
        tts_model,
        transcription_model,
        live_model,
        updated_at,
        updated_by
      )
      VALUES (
        1,
        ${data.chatModel ?? null},
        ${data.backgroundModel ?? null},
        ${data.embeddingModel ?? null},
        ${data.imageModel ?? null},
        ${data.videoModel ?? null},
        ${data.audioModel ?? null},
        ${data.ttsModel ?? null},
        ${data.transcriptionModel ?? null},
        ${data.liveModel ?? null},
        ${new Date()},
        ${updatedBy}
      )
      ON CONFLICT (id) DO UPDATE SET
        chat_model = EXCLUDED.chat_model,
        background_model = EXCLUDED.background_model,
        embedding_model = EXCLUDED.embedding_model,
        image_model = EXCLUDED.image_model,
        video_model = EXCLUDED.video_model,
        audio_model = EXCLUDED.audio_model,
        tts_model = EXCLUDED.tts_model,
        transcription_model = EXCLUDED.transcription_model,
        live_model = EXCLUDED.live_model,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
      RETURNING
        id,
        chat_model AS "chatModel",
        background_model AS "backgroundModel",
        embedding_model AS "embeddingModel",
        image_model AS "imageModel",
        video_model AS "videoModel",
        audio_model AS "audioModel",
        tts_model AS "ttsModel",
        transcription_model AS "transcriptionModel",
        live_model AS "liveModel",
        updated_at AS "updatedAt",
        updated_by AS "updatedBy"
    `);

    invalidateAIConfigCache('slots');
    return normalizeLegacySlotsRow((result.rows as LegacyAiModelSlotsRow[])[0] ?? null)!;
  }
}

export async function getModelSlotsRow(): Promise<AiModelSlotsRow | null> {
  try {
    const rows = await db
      .select()
      .from(aiModelSlots)
      .where(eq(aiModelSlots.id, 1))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (!isMissingOptimizerColumnError(error)) {
      throw error;
    }

    return getLegacyModelSlotsRow();
  }
}

// ── Prompt Templates ──────────────────────────────────────────────────────────

export type CreatePromptVersionInput = {
  key: string;
  name?: string;
  description?: string;
  content: string;
  note?: string;
  createdBy: string;
};

export async function createPromptVersion(
  input: CreatePromptVersionInput,
): Promise<{ template: PromptTemplateRow; version: PromptTemplateVersionRow }> {
  let template = await getPromptTemplateByKey(input.key);

  if (!template) {
    const [newTemplate] = await db
      .insert(promptTemplate)
      .values({
        id: nanoid(),
        key: input.key,
        name: input.name ?? input.key,
        description: input.description ?? null,
        activeVersionId: null,
      })
      .returning();
    template = newTemplate!;
  }

  const maxVersionResult = await db
    .select({ max: max(promptTemplateVersion.version) })
    .from(promptTemplateVersion)
    .where(eq(promptTemplateVersion.templateId, template.id));

  const nextVersion = (maxVersionResult[0]?.max ?? 0) + 1;

  const [version] = await db
    .insert(promptTemplateVersion)
    .values({
      id: nanoid(),
      templateId: template.id,
      version: nextVersion,
      content: input.content,
      note: input.note ?? null,
      createdBy: input.createdBy,
    })
    .returning();

  const [updated] = await db
    .update(promptTemplate)
    .set({ activeVersionId: version!.id, updatedAt: new Date() })
    .where(eq(promptTemplate.id, template.id))
    .returning();

  invalidateAIConfigCache('prompts');
  return { template: updated!, version: version! };
}

export async function rollbackPromptToVersion(
  templateId: string,
  versionId: string,
): Promise<void> {
  const [versionRow] = await db
    .select({ id: promptTemplateVersion.id })
    .from(promptTemplateVersion)
    .where(
      and(
        eq(promptTemplateVersion.id, versionId),
        eq(promptTemplateVersion.templateId, templateId),
      ),
    )
    .limit(1);

  if (!versionRow) throw new Error(`Version ${versionId} does not belong to template ${templateId}`);

  await db
    .update(promptTemplate)
    .set({ activeVersionId: versionId, updatedAt: new Date() })
    .where(eq(promptTemplate.id, templateId));

  invalidateAIConfigCache('prompts');
}

export async function listPromptTemplates(): Promise<PromptTemplateRow[]> {
  return db.select().from(promptTemplate);
}

export async function getPromptTemplateByKey(key: string): Promise<PromptTemplateRow | null> {
  const rows = await db
    .select()
    .from(promptTemplate)
    .where(eq(promptTemplate.key, key))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPromptVersions(templateId: string): Promise<PromptTemplateVersionRow[]> {
  return db
    .select()
    .from(promptTemplateVersion)
    .where(eq(promptTemplateVersion.templateId, templateId))
    .orderBy(desc(promptTemplateVersion.version));
}
