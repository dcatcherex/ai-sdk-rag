import { and, asc, desc, eq, inArray, ne, or, exists } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { brand, brandAsset, brandIcp, brandShare, user as userTable } from '@/db/schema';
import type { Brand, BrandAsset, BrandIcp, BrandIcpInput, BrandImportJson, BrandSharedUser } from './types';

// ── Brand CRUD ────────────────────────────────────────────────────────────────

export async function getBrands(userId: string): Promise<Brand[]> {
  // 1. Own brands
  const ownBrands = await db
    .select()
    .from(brand)
    .where(eq(brand.userId, userId))
    .orderBy(desc(brand.isDefault), brand.createdAt);

  // 2. Share lists for own brands
  const ownIds = ownBrands.map((b) => b.id);
  const shares = ownIds.length > 0
    ? await db
        .select({
          brandId: brandShare.brandId,
          userId: userTable.id,
          name: userTable.name,
          email: userTable.email,
          image: userTable.image,
        })
        .from(brandShare)
        .innerJoin(userTable, eq(brandShare.sharedWithUserId, userTable.id))
        .where(inArray(brandShare.brandId, ownIds))
    : [];
  const shareMap = shares.reduce<Record<string, BrandSharedUser[]>>((acc, s) => {
    (acc[s.brandId] ??= []).push({ id: s.userId, name: s.name, email: s.email, image: s.image });
    return acc;
  }, {});

  const ownOut = ownBrands.map((b) => ({
    ...(b as Brand),
    isOwner: true,
    sharedWith: shareMap[b.id] ?? [],
  }));

  // 3. Brands shared with this user (from other owners)
  const sharedBrands = await db
    .select({
      id: brand.id,
      userId: brand.userId,
      name: brand.name,
      overview: brand.overview,
      websiteUrl: brand.websiteUrl,
      industry: brand.industry,
      targetAudience: brand.targetAudience,
      toneOfVoice: brand.toneOfVoice,
      brandValues: brand.brandValues,
      visualAesthetics: brand.visualAesthetics,
      fonts: brand.fonts,
      colors: brand.colors,
      writingDos: brand.writingDos,
      writingDonts: brand.writingDonts,
      isDefault: brand.isDefault,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    })
    .from(brandShare)
    .innerJoin(brand, eq(brandShare.brandId, brand.id))
    .where(and(eq(brandShare.sharedWithUserId, userId), ne(brand.userId, userId)))
    .orderBy(brand.createdAt);

  const sharedOut = sharedBrands.map((b) => ({
    ...(b as Brand),
    isOwner: false,
    sharedWith: [],
  }));

  return [...ownOut, ...sharedOut];
}

export async function getBrand(userId: string, brandId: string): Promise<Brand | null> {
  // Accessible if owner OR has a share record
  const [row] = await db
    .select()
    .from(brand)
    .where(
      and(
        eq(brand.id, brandId),
        or(
          eq(brand.userId, userId),
          exists(
            db.select({ id: brandShare.id })
              .from(brandShare)
              .where(and(eq(brandShare.brandId, brandId), eq(brandShare.sharedWithUserId, userId))),
          ),
        ),
      ),
    )
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
      colors: data.colors ?? [],
      writingDos: data.writingDos ?? null,
      writingDonts: data.writingDonts ?? null,
      positioningStatement: data.positioningStatement ?? null,
      messagingPillars: data.messagingPillars ?? [],
      proofPoints: data.proofPoints ?? [],
      exampleHeadlines: data.exampleHeadlines ?? [],
      exampleRejections: data.exampleRejections ?? [],
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

// ── Brand Sharing ─────────────────────────────────────────────────────────────

export async function getBrandShareList(ownerId: string, brandId: string): Promise<BrandSharedUser[]> {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    })
    .from(brandShare)
    .innerJoin(userTable, eq(brandShare.sharedWithUserId, userTable.id))
    .where(
      and(
        eq(brandShare.brandId, brandId),
        // Only the owner can list shares — verify via join
        exists(
          db.select({ id: brand.id }).from(brand)
            .where(and(eq(brand.id, brandId), eq(brand.userId, ownerId))),
        ),
      ),
    );
  return rows;
}

export async function addBrandShare(
  ownerId: string,
  brandId: string,
  targetUserId: string,
): Promise<void> {
  // Verify ownership
  const [b] = await db.select({ id: brand.id }).from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.userId, ownerId))).limit(1);
  if (!b) throw new Error('Brand not found');
  if (targetUserId === ownerId) throw new Error('Cannot share with yourself');

  await db.insert(brandShare)
    .values({ id: nanoid(), brandId, sharedWithUserId: targetUserId })
    .onConflictDoNothing();
}

export async function removeBrandShare(
  ownerId: string,
  brandId: string,
  targetUserId: string,
): Promise<void> {
  // Verify ownership
  const [b] = await db.select({ id: brand.id }).from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.userId, ownerId))).limit(1);
  if (!b) throw new Error('Brand not found');

  await db.delete(brandShare)
    .where(and(eq(brandShare.brandId, brandId), eq(brandShare.sharedWithUserId, targetUserId)));
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

// ── Brand ICP CRUD ────────────────────────────────────────────────────────────

export async function getBrandIcps(brandId: string): Promise<BrandIcp[]> {
  return db
    .select()
    .from(brandIcp)
    .where(eq(brandIcp.brandId, brandId))
    .orderBy(asc(brandIcp.sortOrder), asc(brandIcp.createdAt)) as Promise<BrandIcp[]>;
}

export async function createBrandIcp(brandId: string, data: BrandIcpInput): Promise<BrandIcp> {
  const [created] = await db
    .insert(brandIcp)
    .values({ id: nanoid(), brandId, ...data })
    .returning();
  return created as BrandIcp;
}

export async function updateBrandIcp(
  brandId: string,
  icpId: string,
  data: Partial<BrandIcpInput>,
): Promise<BrandIcp | null> {
  const [updated] = await db
    .update(brandIcp)
    .set(data)
    .where(and(eq(brandIcp.id, icpId), eq(brandIcp.brandId, brandId)))
    .returning();
  return (updated as BrandIcp) ?? null;
}

export async function deleteBrandIcp(brandId: string, icpId: string): Promise<void> {
  await db.delete(brandIcp).where(and(eq(brandIcp.id, icpId), eq(brandIcp.brandId, brandId)));
}

// ── Context Block (used by chat route in Phase 2) ─────────────────────────────

export function buildBrandBlock(b: Brand): string {
  const lines: string[] = [
    `Name: ${b.name}`,
    b.overview ? `Overview: ${b.overview}` : '',
    b.industry ? `Industry: ${b.industry}` : '',
    b.targetAudience ? `Target Audience: ${b.targetAudience}` : '',
    b.positioningStatement ? `Positioning: ${b.positioningStatement}` : '',
    b.messagingPillars.length ? `Messaging Pillars: ${b.messagingPillars.join(' | ')}` : '',
    b.proofPoints.length ? `Proof Points: ${b.proofPoints.join(' | ')}` : '',
    b.toneOfVoice.length ? `Tone of Voice: ${b.toneOfVoice.join(', ')}` : '',
    b.brandValues.length ? `Brand Values: ${b.brandValues.join(', ')}` : '',
    b.visualAesthetics.length ? `Visual Style: ${b.visualAesthetics.join(', ')}` : '',
    b.colors.length
      ? `Brand Colors: ${b.colors.filter((c) => c.hex).map((c) => `${c.label} ${c.hex}`).join(', ')}`
      : '',
    b.writingDos ? `Writing guidelines (do): ${b.writingDos}` : '',
    b.writingDonts ? `Writing guidelines (don't): ${b.writingDonts}` : '',
    b.exampleHeadlines.length ? `On-brand headline examples: ${b.exampleHeadlines.join(' | ')}` : '',
    b.exampleRejections.length ? `Off-brand headline examples: ${b.exampleRejections.join(' | ')}` : '',
  ].filter(Boolean);

  return `<brand_context>\n${lines.join('\n')}\n</brand_context>`;
}

/**
 * Full strategic brand context string for content agents.
 * Includes brand fields + all ICP personas.
 * Use this when building prompts for content creation agents.
 */
export async function buildBrandContext(brandId: string): Promise<string> {
  const [b, icps] = await Promise.all([
    db.select().from(brand).where(eq(brand.id, brandId)).limit(1),
    getBrandIcps(brandId),
  ]);
  if (!b[0]) return '';

  const brandSection = buildBrandBlock(b[0] as Brand);

  if (icps.length === 0) return brandSection;

  const icpSection = icps.map((icp) => {
    const parts = [
      `### ${icp.name}`,
      icp.ageRange ? `Age range: ${icp.ageRange}` : '',
      icp.jobTitles.length ? `Job titles: ${icp.jobTitles.join(', ')}` : '',
      icp.painPoints.length ? `Pain points: ${icp.painPoints.join('; ')}` : '',
      icp.buyingTriggers.length ? `Buying triggers: ${icp.buyingTriggers.join('; ')}` : '',
      icp.objections.length ? `Objections: ${icp.objections.join('; ')}` : '',
      icp.channels.length ? `Where they are: ${icp.channels.join(', ')}` : '',
      icp.notes ? `Notes: ${icp.notes}` : '',
    ].filter(Boolean).join('\n');
    return parts;
  }).join('\n\n');

  return `${brandSection}\n\n<audience_personas>\n${icpSection}\n</audience_personas>`;
}

/**
 * Concise style suffix appended to image generation prompts when a brand is active.
 * Keeps the prompt short so it doesn't overwhelm the user's original intent.
 */
export function buildImageBrandSuffix(b: Brand): string {
  const parts: string[] = [];
  if (b.visualAesthetics.length) {
    parts.push(`Visual style: ${b.visualAesthetics.join(', ')}`);
  }
  const colors = b.colors.filter((c) => c.hex).slice(0, 3);
  if (colors.length) {
    parts.push(`Brand colors: ${colors.map((c) => `${c.hex} (${c.label})`).join(', ')}`);
  }
  return parts.length ? `. ${parts.join('. ')}` : '';
}

// BRAND_ASSET_KINDS is in types.ts (client-safe)
