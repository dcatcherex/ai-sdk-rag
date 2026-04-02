export type RepurposeFormat =
  | 'blog_post'
  | 'newsletter'
  | 'linkedin_post'
  | 'tweet_thread'
  | 'social_caption'
  | 'ad_copy'
  | 'email_sequence';

export type RepurposeInput = {
  sourceText: string;
  sourceTitle?: string;
  targetFormats: RepurposeFormat[];
  brandContext?: string;
  tone?: string;
};

export type RepurposeResult = {
  format: RepurposeFormat;
  title: string;
  body: string;
}[];
