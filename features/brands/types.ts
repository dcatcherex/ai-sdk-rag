export type BrandAssetKind = 'logo' | 'product' | 'creative' | 'document' | 'font' | 'other';

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
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorAccent: string | null;
  writingDos: string | null;
  writingDonts: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

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
  campaigns?: {
    creatives?: {
      title?: string;
      versions?: { fileName?: string }[];
    }[];
  }[];
};
