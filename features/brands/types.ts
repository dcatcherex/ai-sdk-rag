export type BrandAssetKind = 'logo' | 'product' | 'creative' | 'document' | 'font' | 'other';

export type BrandColor = {
  hex: string;
  label: string;
};

export type BrandSharedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type Brand = {
  id: string;
  userId: string;
  name: string;
  overview: string | null;
  websiteUrl: string | null;
  industry: string | null;
  targetAudience: string | null;
  toneOfVoice: string[];
  brandValues: string[];
  visualAesthetics: string[];
  fonts: string[];
  /** Flexible color palette — typically 3–5 entries with semantic labels */
  colors: BrandColor[];
  writingDos: string | null;
  writingDonts: string | null;
  // ── Strategy layer ──────────────────────────────────────────────────────
  positioningStatement: string | null;
  messagingPillars: string[];
  proofPoints: string[];
  exampleHeadlines: string[];
  exampleRejections: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Populated by GET /api/brands — true when current user owns this brand */
  isOwner?: boolean;
  /** Populated for owned brands — list of users this brand is shared with */
  sharedWith?: BrandSharedUser[];
};

export type BrandIcp = {
  id: string;
  brandId: string;
  name: string;
  ageRange: string | null;
  jobTitles: string[];
  painPoints: string[];
  buyingTriggers: string[];
  objections: string[];
  channels: string[];
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BrandIcpInput = Omit<BrandIcp, 'id' | 'brandId' | 'createdAt' | 'updatedAt'>;

export type BrandAsset = {
  id: string;
  brandId: string;
  kind: BrandAssetKind;
  collection: string | null;
  title: string;
  r2Key: string;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
};

export type BrandWithAssets = Brand & { assets: BrandAsset[] };

export const BRAND_ASSET_KINDS: BrandAssetKind[] = [
  'logo',
  'product',
  'creative',
  'document',
  'font',
  'other',
];

/** Standard 5-slot palette labels — suggested when creating a new brand */
export const SUGGESTED_COLOR_LABELS = ['Primary', 'Secondary', 'Accent', 'Background', 'Text'] as const;

/** Subset accepted from a pasted JSON import (EdLab-compatible shape) */
export type BrandImportJson = {
  name?: string;
  overview?: string;
  websiteUrl?: string;
  industry?: string;
  targetAudience?: string;
  toneOfVoice?: string[];
  brandValues?: string[];
  visualAesthetics?: string[];
  fonts?: string[];
  colors?: BrandColor[];
  campaigns?: {
    creatives?: {
      title?: string;
      versions?: { fileName?: string }[];
    }[];
  }[];
};
