export type ContentType =
  | 'blog_post'
  | 'newsletter'
  | 'email_sequence'
  | 'landing_page'
  | 'linkedin_post'
  | 'tweet_thread'
  | 'ad_copy';

export type ContentStatus = 'draft' | 'published' | 'archived';

export type ContentPiece = {
  id: string;
  userId: string;
  brandId: string | null;
  contentType: ContentType;
  title: string;
  body: string | null;
  excerpt: string | null;
  status: ContentStatus;
  channel: string | null;
  metadata: Record<string, unknown>;
  parentId: string | null;
  generatedByTeamRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerateBlogPostInput = {
  topic: string;
  targetKeyword?: string;
  tone?: string;
  wordCount?: number;
  brandContext?: string;
  outline?: string;
};

export type GenerateNewsletterInput = {
  topic: string;
  audience?: string;
  tone?: string;
  brandContext?: string;
};

export type GenerateEmailSequenceInput = {
  goal: string;
  product?: string;
  sequenceLength?: number;
  tone?: string;
  brandContext?: string;
};

export type GenerateLandingPageInput = {
  product: string;
  targetAudience?: string;
  keyBenefit?: string;
  tone?: string;
  brandContext?: string;
};

export type GeneratedContent = {
  title: string;
  body: string;
  excerpt: string;
};
