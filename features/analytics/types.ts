export type MetricPlatform =
  | 'linkedin'
  | 'twitter'
  | 'email'
  | 'blog'
  | 'instagram'
  | 'facebook'
  | 'other';

export type ContentPieceMetric = {
  id: string;
  contentPieceId: string;
  userId: string;
  platform: MetricPlatform;
  views: number;
  clicks: number;
  impressions: number;
  engagement: number;
  conversions: number;
  ctr: number | null;
  notes: string | null;
  measuredAt: Date;
  createdAt: Date;
};

export type TrackMetricInput = {
  contentPieceId: string;
  platform: MetricPlatform;
  views?: number;
  clicks?: number;
  impressions?: number;
  engagement?: number;
  conversions?: number;
  notes?: string;
  measuredAt?: string; // ISO date string, defaults to now
};

export type AbVariant = {
  id: string;
  contentPieceId: string;
  userId: string;
  variantLabel: string;
  body: string;
  impressions: number;
  clicks: number;
  conversions: number;
  isWinner: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAbVariantInput = {
  contentPieceId: string;
  variantLabel: string;
  body: string;
};

export type ContentPerformanceSummary = {
  contentPieceId: string;
  totalViews: number;
  totalClicks: number;
  totalImpressions: number;
  totalEngagement: number;
  totalConversions: number;
  avgCtr: number | null;
  byPlatform: Array<{
    platform: MetricPlatform;
    views: number;
    clicks: number;
    impressions: number;
    engagement: number;
    conversions: number;
  }>;
  metrics: ContentPieceMetric[];
};

export type PerformanceAnalysis = {
  summary: string;
  topInsights: string[];
  recommendations: string[];
  score: number; // 0-100
};
