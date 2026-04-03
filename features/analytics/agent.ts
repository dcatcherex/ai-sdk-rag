import { tool } from 'ai';
import { z } from 'zod';
import {
  trackMetric,
  getContentPerformanceSummary,
  analyzeContentPerformance,
} from './service';
import type { MetricPlatform } from './types';

type AnalyticsToolContext = { userId: string };

export function createAnalyticsAgentTools({ userId }: AnalyticsToolContext) {
  return {
    track_content_metric: tool({
      description:
        'Record a performance metric snapshot for a content piece on a specific platform. Call this when a user wants to log views, clicks, impressions, engagement, or conversions.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('ID of the content piece'),
        platform: z
          .enum(['linkedin', 'twitter', 'email', 'blog', 'instagram', 'facebook', 'other'])
          .describe('Platform where the content was published'),
        views: z.number().int().min(0).optional().describe('Total view count'),
        clicks: z.number().int().min(0).optional().describe('Total click count'),
        impressions: z.number().int().min(0).optional().describe('Total impression count'),
        engagement: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Total engagement (likes + shares + comments)'),
        conversions: z.number().int().min(0).optional().describe('Total conversion count'),
        notes: z.string().optional().describe('Optional notes about this measurement'),
        measuredAt: z
          .string()
          .optional()
          .describe('ISO date string for when metrics were measured (defaults to now)'),
      }),
      async execute(input) {
        const metric = await trackMetric(userId, {
          ...input,
          platform: input.platform as MetricPlatform,
        });
        return {
          success: true,
          metric: {
            id: metric.id,
            platform: metric.platform,
            views: metric.views,
            clicks: metric.clicks,
            impressions: metric.impressions,
            engagement: metric.engagement,
            conversions: metric.conversions,
            ctr: metric.ctr,
            measuredAt: metric.measuredAt,
          },
        };
      },
    }),

    get_content_metrics: tool({
      description:
        'Get all recorded performance metrics for a content piece. Returns a summary of total metrics broken down by platform.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('ID of the content piece to get metrics for'),
      }),
      async execute({ contentPieceId }) {
        const summary = await getContentPerformanceSummary(userId, contentPieceId);
        return {
          contentPieceId,
          totalViews: summary.totalViews,
          totalClicks: summary.totalClicks,
          totalImpressions: summary.totalImpressions,
          totalEngagement: summary.totalEngagement,
          totalConversions: summary.totalConversions,
          avgCtr: summary.avgCtr,
          byPlatform: summary.byPlatform,
          metricCount: summary.metrics.length,
        };
      },
    }),

    analyze_content_performance: tool({
      description:
        'Use AI to analyze the performance of a content piece and get actionable recommendations. Returns a score, key insights, and specific recommendations for improvement.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('ID of the content piece to analyze'),
      }),
      async execute({ contentPieceId }) {
        return analyzeContentPerformance(userId, contentPieceId);
      },
    }),
  };
}
