/**
 * Canonical brand profile business logic.
 * Supports both web users (userId) and non-member LINE users (lineUserId + channelId).
 * Agent adapter, API route, and sidebar all call this — never duplicate logic elsewhere.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { brandProfile } from '@/db/schema/tools';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import {
  REQUIRED_FIELDS,
  type GetBrandProfileInput,
  type SaveBrandProfileInput,
  type BrandProfileOutput,
  type SaveBrandProfileOutput,
  type AddStyleReferenceInput,
  type RemoveStyleReferenceInput,
  type StyleReferenceOutput,
} from './schema';
import { parseStyleUrls } from './utils';
export { parseStyleUrls } from './utils';

export type BrandProfileContext = {
  userId?: string;
  lineUserId?: string;
  channelId?: string;
};

function buildWhereClause(ctx: BrandProfileContext) {
  if (ctx.userId) {
    return eq(brandProfile.userId, ctx.userId);
  }
  if (ctx.lineUserId && ctx.channelId) {
    return and(
      eq(brandProfile.lineUserId, ctx.lineUserId),
      eq(brandProfile.channelId, ctx.channelId),
    );
  }
  if (ctx.lineUserId) {
    return and(eq(brandProfile.lineUserId, ctx.lineUserId), isNull(brandProfile.channelId));
  }
  throw new Error('BrandProfileContext requires userId or lineUserId');
}

function computeStatus(fields: Record<string, string>): { missingRequired: string[]; isComplete: boolean } {
  const missingRequired = REQUIRED_FIELDS.filter((f) => !fields[f]);
  return { missingRequired, isComplete: missingRequired.length === 0 };
}

// ── Raw service functions (used by agent.ts) ──────────────────────────────────

export async function runGetBrandProfile(
  _input: GetBrandProfileInput,
  ctx: BrandProfileContext,
): Promise<BrandProfileOutput> {
  const rows = await db
    .select({ field: brandProfile.field, value: brandProfile.value })
    .from(brandProfile)
    .where(buildWhereClause(ctx));

  const fields = Object.fromEntries(rows.map((r) => [r.field, r.value]));
  return { fields, ...computeStatus(fields) };
}

const URL_FIELDS = new Set(['logo_url']);

export async function runAddStyleReference(
  input: AddStyleReferenceInput,
  ctx: BrandProfileContext,
): Promise<StyleReferenceOutput> {
  const profile = await runGetBrandProfile({}, ctx);
  const urls = parseStyleUrls(profile.fields);
  if (!urls.includes(input.url)) urls.push(input.url);
  await runSaveBrandProfile({ field: 'style_reference_urls', value: JSON.stringify(urls) }, ctx);
  return { urls, count: urls.length };
}

export async function runRemoveStyleReference(
  input: RemoveStyleReferenceInput,
  ctx: BrandProfileContext,
): Promise<StyleReferenceOutput> {
  const profile = await runGetBrandProfile({}, ctx);
  const urls = parseStyleUrls(profile.fields).filter((u) => u !== input.url);
  await runSaveBrandProfile({ field: 'style_reference_urls', value: JSON.stringify(urls) }, ctx);
  return { urls, count: urls.length };
}

export async function runSaveBrandProfile(
  input: SaveBrandProfileInput,
  ctx: BrandProfileContext,
): Promise<SaveBrandProfileOutput> {
  if (URL_FIELDS.has(input.field) && !input.value.startsWith('https://')) {
    throw new Error(`${input.field} must be a valid https:// URL`);
  }
  const existing = await db
    .select({ id: brandProfile.id })
    .from(brandProfile)
    .where(and(buildWhereClause(ctx), eq(brandProfile.field, input.field)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(brandProfile)
      .set({ value: input.value, updatedAt: new Date() })
      .where(and(buildWhereClause(ctx), eq(brandProfile.field, input.field)));
  } else {
    await db.insert(brandProfile).values({
      id: nanoid(),
      userId: ctx.userId ?? null,
      lineUserId: ctx.lineUserId ?? null,
      channelId: ctx.channelId ?? null,
      field: input.field,
      value: input.value,
      updatedAt: new Date(),
    });
  }

  const all = await runGetBrandProfile({}, ctx);
  return { saved: true, field: input.field, value: input.value, ...computeStatus(all.fields) };
}

// ── Action wrappers (used by API routes and sidebar) ─────────────────────────

export async function getBrandProfileAction(
  input: GetBrandProfileInput,
  ctx: BrandProfileContext,
): Promise<ToolExecutionResult<BrandProfileOutput>> {
  const data = await runGetBrandProfile(input, ctx);
  return {
    tool: 'brand_profile',
    runId: nanoid(),
    title: 'Brand Profile',
    summary: data.isComplete ? 'Complete' : `${data.missingRequired.length} required fields missing`,
    data,
    createdAt: new Date().toISOString(),
  };
}

export async function saveBrandProfileAction(
  input: SaveBrandProfileInput,
  ctx: BrandProfileContext,
): Promise<ToolExecutionResult<SaveBrandProfileOutput>> {
  const data = await runSaveBrandProfile(input, ctx);
  return {
    tool: 'brand_profile',
    runId: nanoid(),
    title: `Saved: ${input.field}`,
    data,
    createdAt: new Date().toISOString(),
  };
}

export async function addStyleReferenceAction(
  input: AddStyleReferenceInput,
  ctx: BrandProfileContext,
): Promise<ToolExecutionResult<StyleReferenceOutput>> {
  const data = await runAddStyleReference(input, ctx);
  return { tool: 'brand_profile', runId: nanoid(), title: 'Added style reference', data, createdAt: new Date().toISOString() };
}

export async function removeStyleReferenceAction(
  input: RemoveStyleReferenceInput,
  ctx: BrandProfileContext,
): Promise<ToolExecutionResult<StyleReferenceOutput>> {
  const data = await runRemoveStyleReference(input, ctx);
  return { tool: 'brand_profile', runId: nanoid(), title: 'Removed style reference', data, createdAt: new Date().toISOString() };
}
