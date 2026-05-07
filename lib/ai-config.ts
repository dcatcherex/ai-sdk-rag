import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiModelSlots, promptTemplate, promptTemplateVersion } from '@/db/schema';
import type { AiModelSlotsRow } from '@/db/schema';

// ── Fallbacks (mirror current hardcoded values — used when DB slot is NULL) ───

const SLOT_DEFAULTS = {
  chatModel:          'google/gemini-3.1-flash-lite-preview',
  backgroundModel:    'google/gemini-2.5-flash-lite',
  optimizerModel:     'google/gemini-2.5-flash-lite',
  embeddingModel:     'mistral/mistral-embed',
  imageModel:         'google/gemini-3.1-flash-image-preview',
  videoModel:         null as string | null,
  audioModel:         null as string | null,
  ttsModel:           'gemini-3.1-flash-tts-preview',
  transcriptionModel: 'gemini-2.5-flash-lite',
  liveModel:          'gemini-3.1-flash-live-preview',
} as const;

export type ModelSlotName = keyof typeof SLOT_DEFAULTS;

// ── 60-second in-process cache ────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

let slotsEntry: CacheEntry<AiModelSlotsRow> | null = null;
const promptEntries = new Map<string, CacheEntry<string>>();

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() < entry.expiresAt;
}

// ── Null row fallback (when ai_model_slots not yet seeded) ────────────────────

const NULL_SLOTS_ROW: AiModelSlotsRow = {
  id: 1,
  chatModel: null,
  backgroundModel: null,
  optimizerModel: null,
  embeddingModel: null,
  imageModel: null,
  videoModel: null,
  audioModel: null,
  ttsModel: null,
  transcriptionModel: null,
  liveModel: null,
  updatedAt: new Date(),
  updatedBy: null,
};

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

function normalizeLegacySlotsRow(row: LegacyAiModelSlotsRow | undefined | null): AiModelSlotsRow {
  if (!row) return NULL_SLOTS_ROW;

  return {
    ...row,
    optimizerModel: null,
  };
}

async function getLegacyModelSlotsRow(): Promise<AiModelSlotsRow> {
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the full slots row. Cached for 60 s.
 * Callers needing multiple slots should call this once and destructure.
 */
export async function getModelSlots(): Promise<AiModelSlotsRow> {
  if (isFresh(slotsEntry)) return slotsEntry.value;

  let row: AiModelSlotsRow;

  try {
    const rows = await db
      .select()
      .from(aiModelSlots)
      .where(eq(aiModelSlots.id, 1))
      .limit(1);

    row = rows[0] ?? NULL_SLOTS_ROW;
  } catch (error) {
    if (!isMissingOptimizerColumnError(error)) {
      throw error;
    }

    row = await getLegacyModelSlotsRow();
  }

  slotsEntry = { value: row, expiresAt: Date.now() + CACHE_TTL_MS };
  return row;
}

// Slots that always have a non-null fallback in SLOT_DEFAULTS
type RequiredSlot = 'chatModel' | 'backgroundModel' | 'optimizerModel' | 'embeddingModel' | 'imageModel' | 'ttsModel' | 'transcriptionModel' | 'liveModel';
// Slots that may have no default (not all deployments support these)
type OptionalSlot = 'videoModel' | 'audioModel';

export async function getModelSlot(slot: RequiredSlot): Promise<string>;
export async function getModelSlot(slot: OptionalSlot): Promise<string | null>;
export async function getModelSlot(slot: ModelSlotName): Promise<string | null>;
export async function getModelSlot(slot: ModelSlotName): Promise<string | null> {
  const slots = await getModelSlots();
  if (slot === 'optimizerModel') {
    return slots.optimizerModel ?? slots.backgroundModel ?? SLOT_DEFAULTS.optimizerModel;
  }
  return (slots[slot] as string | null) ?? SLOT_DEFAULTS[slot] ?? null;
}

/**
 * Returns the active prompt content for a key.
 * Falls back to `fallback` when no DB template exists for that key.
 * Cached per key for 60 s.
 */
export async function getPrompt(key: string, fallback = ''): Promise<string> {
  const cached = promptEntries.get(key) ?? null;
  if (isFresh(cached)) return cached.value;

  const rows = await db
    .select({ content: promptTemplateVersion.content })
    .from(promptTemplate)
    .innerJoin(
      promptTemplateVersion,
      eq(promptTemplate.activeVersionId, promptTemplateVersion.id),
    )
    .where(eq(promptTemplate.key, key))
    .limit(1);

  const content = rows[0]?.content ?? fallback;
  promptEntries.set(key, { value: content, expiresAt: Date.now() + CACHE_TTL_MS });
  return content;
}

/**
 * Drops in-process cached config. Call after any admin write to ai_model_slots
 * or ai_prompt_template. In multi-instance deployments other instances will
 * serve stale config for up to CACHE_TTL_MS (60 s) — this is acceptable.
 */
export function invalidateAIConfigCache(target: 'slots' | 'prompts' | 'all' = 'all'): void {
  if (target === 'slots' || target === 'all') slotsEntry = null;
  if (target === 'prompts' || target === 'all') promptEntries.clear();
}
