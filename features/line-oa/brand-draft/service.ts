import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { lineBrandDraft } from '@/db/schema';
import {
  LINE_BRAND_DRAFT_REQUIRED_FIELDS,
  type AddLineBrandStyleReferenceInput,
  type GetLineBrandDraftInput,
  type LineBrandDraftOutput,
  type LineBrandStyleReferenceOutput,
  type RemoveLineBrandStyleReferenceInput,
  type SaveLineBrandDraftFieldInput,
  type SaveLineBrandDraftFieldOutput,
} from './schema';
import { parseLineDraftLogoUrls, parseLineDraftStyleUrls } from './utils';

export type LineBrandDraftContext = {
  lineUserId: string;
  channelId: string;
};

function computeStatus(fields: Record<string, string>) {
  const missingRequired = LINE_BRAND_DRAFT_REQUIRED_FIELDS.filter((field) => !fields[field]);
  return { missingRequired, isComplete: missingRequired.length === 0 };
}

function sampleUrls(urls: string[], maxCount: number): string[] {
  return urls.slice(0, maxCount);
}

export async function runGetLineBrandDraft(
  _input: GetLineBrandDraftInput,
  ctx: LineBrandDraftContext,
): Promise<LineBrandDraftOutput> {
  const rows = await db
    .select({ field: lineBrandDraft.field, value: lineBrandDraft.value })
    .from(lineBrandDraft)
    .where(and(eq(lineBrandDraft.lineUserId, ctx.lineUserId), eq(lineBrandDraft.channelId, ctx.channelId)));

  const fields = Object.fromEntries(rows.map((row) => [row.field, row.value]));

  return {
    fields,
    styleReferenceUrls: sampleUrls(parseLineDraftStyleUrls(fields), 3),
    logoUrls: sampleUrls(parseLineDraftLogoUrls(fields), 2),
    styleDescription: fields.style_description ?? null,
    visualStyle: fields.visual_style ?? null,
    colorPalette: fields.color_palette ?? null,
    ...computeStatus(fields),
  };
}

export async function runSaveLineBrandDraftField(
  input: SaveLineBrandDraftFieldInput,
  ctx: LineBrandDraftContext,
): Promise<SaveLineBrandDraftFieldOutput> {
  const [existing] = await db
    .select({ id: lineBrandDraft.id })
    .from(lineBrandDraft)
    .where(
      and(
        eq(lineBrandDraft.lineUserId, ctx.lineUserId),
        eq(lineBrandDraft.channelId, ctx.channelId),
        eq(lineBrandDraft.field, input.field),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(lineBrandDraft)
      .set({ value: input.value, updatedAt: new Date() })
      .where(eq(lineBrandDraft.id, existing.id));
  } else {
    await db.insert(lineBrandDraft).values({
      id: nanoid(),
      lineUserId: ctx.lineUserId,
      channelId: ctx.channelId,
      field: input.field,
      value: input.value,
      updatedAt: new Date(),
    });
  }

  const all = await runGetLineBrandDraft({}, ctx);
  return {
    saved: true,
    field: input.field,
    value: input.value,
    missingRequired: all.missingRequired,
    isComplete: all.isComplete,
  };
}

export async function runAddLineBrandStyleReference(
  input: AddLineBrandStyleReferenceInput,
  ctx: LineBrandDraftContext,
): Promise<LineBrandStyleReferenceOutput> {
  const draft = await runGetLineBrandDraft({}, ctx);
  const urls = parseLineDraftStyleUrls(draft.fields);
  if (!urls.includes(input.url)) urls.push(input.url);
  await runSaveLineBrandDraftField({ field: 'style_reference_urls', value: JSON.stringify(urls) }, ctx);
  return { urls, count: urls.length };
}

export async function runRemoveLineBrandStyleReference(
  input: RemoveLineBrandStyleReferenceInput,
  ctx: LineBrandDraftContext,
): Promise<LineBrandStyleReferenceOutput> {
  const draft = await runGetLineBrandDraft({}, ctx);
  const urls = parseLineDraftStyleUrls(draft.fields).filter((url) => url !== input.url);
  await runSaveLineBrandDraftField({ field: 'style_reference_urls', value: JSON.stringify(urls) }, ctx);
  return { urls, count: urls.length };
}
