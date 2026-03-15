export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type PostMedia = {
  r2Key: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

/** Per-platform caption/settings overrides */
export type PlatformOverride = {
  caption?: string;
};

export type PlatformOverrides = Partial<Record<SocialPlatform, PlatformOverride>>;

export type SocialPostRecord = {
  id: string;
  userId: string;
  caption: string;
  platforms: SocialPlatform[];
  platformOverrides: PlatformOverrides;
  media: PostMedia[];
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  brandId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerateCaptionsInput = {
  topic: string;
  platforms: SocialPlatform[];
  tone?: string;
  brandContext?: string;
};

export type GenerateCaptionsResult = {
  base: string;
  overrides: PlatformOverrides;
};

export type CreatePostInput = {
  userId: string;
  caption: string;
  platforms: SocialPlatform[];
  platformOverrides?: PlatformOverrides;
  media?: PostMedia[];
  scheduledAt?: Date;
  brandId?: string;
};

export type UpdatePostInput = {
  postId: string;
  userId: string;
  caption?: string;
  platforms?: SocialPlatform[];
  platformOverrides?: PlatformOverrides;
  media?: PostMedia[];
  scheduledAt?: Date | null;
  status?: PostStatus;
};

// ── Social Accounts ───────────────────────────────────────────────────────────

export type SocialAccountRecord = {
  id: string;
  userId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  accountName: string;
  accountType: string | null;
  /** accessToken is omitted from client-facing responses */
  tokenExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectAccountInput = {
  userId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  accountName: string;
  accountType?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
};

export type PublishPostInput = {
  postId: string;
  userId: string;
  /** Limit publishing to specific platforms (defaults to all on the post) */
  platforms?: SocialPlatform[];
};

export type PublishResult = {
  platform: SocialPlatform;
  success: boolean;
  platformPostId?: string;
  error?: string;
};
