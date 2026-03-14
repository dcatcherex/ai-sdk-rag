import { and, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { brand, brandAsset } from '@/db/schema';
import type { Brand, BrandAsset, BrandAssetKind, BrandImportJson } from './types';

// ── Brand CRUD ────────────────────────────────────────────────────────────────

export async function getBrands(userId: string): Promise<Brand[]> {
  return db
    .select()
    .from(brand)
    .where(eq(brand.userId, userId))
    .orderBy(desc(brand.isDefault), brand.createdAt) as Promise<Brand[]>;
}

export async function getBrand(userId: string, brandId: string): Promise<Brand | null> {
  const [row] = await db
    .select()
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.userId, userId)))
    .limit(1);
  return (row as Brand) ?? null;
}

type BrandInput = Partial<Omit<Brand, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

export async function createBrand(userId: string, data: BrandInput): Promise<Brand> {
  const [created] = await db
    .insert(brand)
    .values({
      id: nanoid(),
      userId,
      name: data.name ?? 'Untitled Brand',
      overview: data.overview ?? null,
      websiteUrl: data.websiteUrl ?? null,
      industry: data.industry ?? null,
      targetAudience: data.targetAudience ?? null,
      toneOfVoice: data.toneOfVoice ?? [],
      brandValues: data.brandValues ?? [],
      visualAesthetics: data.visualAesthetics ?? [],
      fonts: data.fonts ?? [],
      colorPrimary: data.colorPrimary ?? null,
      colorSecondary: data.colorSecondary ?? null,
      colorAccent: data.colorAccent ?? null,
      writingDos: data.writingDos ?? null,
      writingDonts: data.writingDonts ?? null,
      isDefault: data.isDefault ?? false,
    })
    .returning();
  return created as Brand;
}

export async function updateBrand(
  userId: string,
  brandId: string,
  data: BrandInput,
): Promise<Brand | null> {
  const [updated] = await db
    .update(brand)
    .set(data)
    .where(and(eq(brand.id, brandId), eq(brand.userId, userId)))
    .returning();
  return (updated as Brand) ?? null;
}

export async function deleteBrand(userId: string, brandId: string): Promise<void> {
  await db.delete(brand).where(and(eq(brand.id, brandId), eq(brand.userId, userId)));
}

export async function setDefaultBrand(userId: string, brandId: string): Promise<void> {
  await db.update(brand).set({ isDefault: false }).where(eq(brand.userId, userId));
  await db
    .update(brand)
    .set({ isDefault: true })
    .where(and(eq(brand.id, brandId), eq(brand.userId, userId)));
}

// ── Brand Assets ──────────────────────────────────────────────────────────────

export async function getBrandAssets(brandId: string): Promise<BrandAsset[]> {
  return db
    .select()
    .from(brandAsset)
    .where(eq(brandAsset.brandId, brandId))
    .orderBy(brandAsset.sortOrder, brandAsset.createdAt) as Promise<BrandAsset[]>;
}

export async function createBrandAsset(
  data: Omit<BrandAsset, 'id' | 'createdAt'>,
): Promise<BrandAsset> {
  const [created] = await db
    .insert(brandAsset)
    .values({ id: nanoid(), ...data })
    .returning();
  return created as BrandAsset;
}

export async function deleteBrandAsset(brandId: string, assetId: string): Promise<void> {
  await db
    .delete(brandAsset)
    .where(and(eq(brandAsset.id, assetId), eq(brandAsset.brandId, brandId)));
}

// ── JSON Import ───────────────────────────────────────────────────────────────

export async function importBrandFromJson(
  userId: string,
  json: BrandImportJson,
): Promise<Brand> {
  return createBrand(userId, {
    name: json.name ?? 'Imported Brand',
    overview: json.overview ?? null,
    websiteUrl: json.websiteUrl ?? null,
    industry: json.industry ?? null,
    targetAudience: json.targetAudience ?? null,
    toneOfVoice: json.toneOfVoice ?? [],
    brandValues: json.brandValues ?? [],
    visualAesthetics: json.visualAesthetics ?? [],
    fonts: json.fonts ?? [],
  });
}

// ── Context Block (used by chat route in Phase 2) ─────────────────────────────

export function buildBrandBlock(b: Brand): string {
  const lines: string[] = [
    `Name: ${b.name}`,
    b.overview ? `Overview: ${b.overview}` : '',
    b.targetAudience ? `Target Audience: ${b.targetAudience}` : '',
    b.toneOfVoice.length ? `Tone of Voice: ${b.toneOfVoice.join(', ')}` : '',
    b.brandValues.length ? `Brand Values: ${b.brandValues.join(', ')}` : '',
    b.visualAesthetics.length ? `Visual Style: ${b.visualAesthetics.join(', ')}` : '',
    b.writingDos ? `Writing guidelines (do): ${b.writingDos}` : '',
    b.writingDonts ? `Writing guidelines (don't): ${b.writingDonts}` : '',
  ].filter(Boolean);

  return `<brand_context>\n${lines.join('\n')}\n</brand_context>`;
}

// BRAND_ASSET_KINDS is in types.ts (client-safe)
