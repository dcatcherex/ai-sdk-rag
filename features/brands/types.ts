export type BrandAssetKind = 'logo' | 'style_reference' | 'document' | 'font' | 'other';

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
  productsServices: string | null;
  targetAudience: string | null;
  toneOfVoice: string[];
  brandValues: string[];
  voiceExamples: string[];
  forbiddenPhrases: string[];
  visualAesthetics: string[];
  fonts: string[];
  colors: BrandColor[];
  colorNotes: string | null;
  styleReferenceMode: string;
  styleDescription: string | null;
  writingDos: string | null;
  writingDonts: string | null;
  usp: string | null;
  priceRange: string | null;
  keywords: string[];
  platforms: string[];
  promotionStyle: string | null;
  competitors: string[];
  customerPainPoints: string[];
  positioningStatement: string | null;
  messagingPillars: string[];
  proofPoints: string[];
  exampleHeadlines: string[];
  exampleRejections: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  isOwner?: boolean;
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
  'style_reference',
  'document',
  'font',
  'other',
];

export const SUGGESTED_COLOR_LABELS = ['Primary', 'Secondary', 'Accent', 'Background', 'Text'] as const;

export type BrandImportJson = {
  name?: string;
  overview?: string;
  websiteUrl?: string;
  industry?: string;
  productsServices?: string | null;
  targetAudience?: string;
  toneOfVoice?: string[];
  brandValues?: string[];
  voiceExamples?: string[];
  forbiddenPhrases?: string[];
  visualAesthetics?: string[];
  fonts?: string[];
  colors?: BrandColor[];
  colorNotes?: string | null;
  styleReferenceMode?: string;
  styleDescription?: string | null;
  usp?: string | null;
  priceRange?: string | null;
  keywords?: string[];
  platforms?: string[];
  promotionStyle?: string | null;
  competitors?: string[];
  customerPainPoints?: string[];
  campaigns?: {
    creatives?: {
      title?: string;
      versions?: { fileName?: string }[];
    }[];
  }[];
};
