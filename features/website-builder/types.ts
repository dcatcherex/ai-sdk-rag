export type WebsiteTemplateSlug = 'portfolio' | 'service-landing' | 'consulting' | 'personal';
export type WebsiteStatus = 'draft' | 'generating' | 'ready' | 'publishing' | 'published' | 'failed';
export type SiteActionSource = 'sidebar' | 'agent' | 'api';

export type HeroSectionData = {
  headline: string;
  subtext: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl?: string;
};

export type FeaturesSectionData = {
  heading: string;
  features: Array<{ title: string; description: string; icon?: string }>;
};

export type AboutSectionData = {
  heading: string;
  body: string;
  imageUrl?: string;
};

export type TestimonialsSectionData = {
  heading: string;
  testimonials: Array<{ quote: string; author: string; role?: string }>;
};

export type PricingSectionData = {
  heading: string;
  plans: Array<{ name: string; price: string; features: string[]; highlighted?: boolean }>;
};

export type FaqSectionData = {
  heading: string;
  items: Array<{ question: string; answer: string }>;
};

export type ContactSectionData = {
  heading: string;
  email?: string;
  phone?: string;
  address?: string;
  formEnabled: boolean;
};

export type CtaSectionData = {
  heading: string;
  subtext: string;
  ctaText: string;
  ctaUrl: string;
};

export type SiteSection =
  | { id: string; type: 'hero'; visible: boolean; data: HeroSectionData }
  | { id: string; type: 'features'; visible: boolean; data: FeaturesSectionData }
  | { id: string; type: 'about'; visible: boolean; data: AboutSectionData }
  | { id: string; type: 'testimonials'; visible: boolean; data: TestimonialsSectionData }
  | { id: string; type: 'pricing'; visible: boolean; data: PricingSectionData }
  | { id: string; type: 'faq'; visible: boolean; data: FaqSectionData }
  | { id: string; type: 'contact'; visible: boolean; data: ContactSectionData }
  | { id: string; type: 'cta'; visible: boolean; data: CtaSectionData };

export type SiteDataJson = {
  templateSlug: WebsiteTemplateSlug;
  siteName: string;
  tagline: string;
  heroHeadline: string;
  heroSubtext: string;
  primaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  ctaText: string;
  ctaUrl: string;
  sections: SiteSection[];
  meta: { title: string; description: string; keywords?: string[] };
  businessDescription: string;
  generatedAt: string;
};

export type WebsiteRecord = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  templateSlug: string;
  status: WebsiteStatus;
  siteDataJson: SiteDataJson | null;
  renderedHtmlKey: string | null;
  renderedHtmlUrl: string | null;
  pagesProjectName: string | null;
  pagesDeploymentId: string | null;
  liveUrl: string | null;
  customDomain: string | null;
  error: string | null;
  generationCount: number;
  editCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export const WEBSITE_CREDIT_COSTS = {
  generate: 100,
  editSimple: 10,
  editStructural: 20,
  publish: 5,
} as const;
