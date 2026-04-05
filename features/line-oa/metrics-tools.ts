/**
 * AI SDK tool definitions for the LINE Metrics Reporter agent.
 *
 * Call buildLineMetricsTools(userId, channelId) to get a tools object
 * ready to pass to generateText().
 *
 * userId may be null for non-linked users — write tools that require
 * content piece ownership will return a helpful error.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { contentPiece } from '@/db/schema';
import { trackMetric, getContentPerformanceSummary } from '@/features/analytics/service';
import { getChannelStats } from './analytics';

const NOT_LINKED_MSG =
  'Your LINE account is not linked. ' +
  'Type /link TOKEN (get your token in Settings → LINE OA → Link Account) ' +
  'to connect your account and unlock metric logging.';

const PLATFORM_VALUES = [
  'instagram', 'facebook', 'linkedin', 'twitter', 'email', 'blog', 'other',
] as const;

export function buildLineMetricsTools(userId: string | null, channelId: string) {
  return {
    /** List recent content pieces so the user can identify which one to log metrics for */
    list_recent_content: tool({
      description:
        'List the most recent published or approved content pieces. ' +
        'Use this to find the content piece ID before logging metrics.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!userId) return { pieces: [] as Array<{ id: string; title: string; status: string; createdAt: string }>, message: NOT_LINKED_MSG };
        const rows = await db
          .select({ id: contentPiece.id, title: contentPiece.title, status: contentPiece.status, createdAt: contentPiece.createdAt })
          .from(contentPiece)
          .where(eq(contentPiece.userId, userId))
          .orderBy(desc(contentPiece.createdAt))
          .limit(8);
        const pieces = rows.map((r) => ({
          id: r.id.slice(0, 8),
          fullId: r.id,
          title: r.title,
          status: r.status ?? 'draft',
          createdAt: r.createdAt.toISOString().slice(0, 10),
        }));
        return {
          pieces,
          message: pieces.length === 0 ? 'No content pieces yet.' : `Found ${pieces.length} piece(s).`,
        };
      },
    }),

    /** Log engagement numbers for a content piece on a specific platform */
    log_content_metric: tool({
      description:
        'Log performance metrics (views, likes, clicks, impressions) for a content piece on a specific platform. ' +
        'Use list_recent_content first to get the full content piece ID.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('Full content piece ID from list_recent_content'),
        platform: z.enum(PLATFORM_VALUES).describe('Platform where the metrics were measured'),
        views: z.number().int().min(0).optional().describe('Number of views or plays'),
        impressions: z.number().int().min(0).optional().describe('Total impressions / reach'),
        engagement: z.number().int().min(0).optional().describe('Likes + shares + comments combined'),
        clicks: z.number().int().min(0).optional().describe('Link clicks or CTA taps'),
        conversions: z.number().int().min(0).optional().describe('Conversions attributed to this post'),
        notes: z.string().optional().describe('Any extra context, e.g. "boosted post" or "peak time"'),
      }),
      execute: async ({ contentPieceId, platform, views, impressions, engagement, clicks, conversions, notes }) => {
        if (!userId) return { success: false, message: NOT_LINKED_MSG };
        try {
          const metric = await trackMetric(userId, {
            contentPieceId,
            platform,
            views,
            impressions,
            engagement,
            clicks,
            conversions,
            notes,
          });
          return {
            success: true,
            metricId: metric.id,
            message: `Metrics logged for ${platform}. CTR: ${metric.ctr != null ? (metric.ctr * 100).toFixed(2) + '%' : 'n/a'}`,
          };
        } catch (err) {
          return { success: false, message: `Failed to log metrics: ${(err as Error).message}` };
        }
      },
    }),

    /** Show aggregated performance for a content piece */
    get_content_performance: tool({
      description:
        'Show total views, clicks, impressions, and engagement for a content piece across all platforms.',
      inputSchema: z.object({
        contentPieceId: z.string().describe('Full content piece ID'),
      }),
      execute: async ({ contentPieceId }) => {
        if (!userId) return { summary: null, message: NOT_LINKED_MSG };
        const summary = await getContentPerformanceSummary(userId, contentPieceId);
        const byPlatform = summary.byPlatform.map((p) => ({
          platform: p.platform,
          views: p.views,
          engagement: p.engagement,
          impressions: p.impressions,
          clicks: p.clicks,
        }));
        return {
          totalViews: summary.totalViews,
          totalEngagement: summary.totalEngagement,
          totalImpressions: summary.totalImpressions,
          totalClicks: summary.totalClicks,
          totalConversions: summary.totalConversions,
          avgCtr: summary.avgCtr != null ? `${(summary.avgCtr * 100).toFixed(2)}%` : null,
          byPlatform,
          message: `Performance summary across ${byPlatform.length} platform(s).`,
        };
      },
    }),

    /** Show this LINE channel's recent daily engagement stats */
    get_channel_stats: tool({
      description:
        'Show this LINE OA channel\'s daily message volume, active users, tool usage, and images sent for the last 7 or 30 days.',
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe('Number of days to look back (default 7)'),
      }),
      execute: async ({ days }) => {
        const stats = await getChannelStats(channelId, days ?? 7);
        if (stats.length === 0) {
          return { stats: [], message: 'No data yet for this channel.' };
        }
        const totalMessages = stats.reduce((s, r) => s + r.messageCount, 0);
        const peakDay = stats.reduce((a, b) => (a.messageCount >= b.messageCount ? a : b));
        return {
          stats,
          totalMessages,
          peakDay: { date: peakDay.date, messageCount: peakDay.messageCount },
          message: `${totalMessages} messages over the last ${stats.length} day(s). Peak: ${peakDay.messageCount} messages on ${peakDay.date}.`,
        };
      },
    }),
  };
}
