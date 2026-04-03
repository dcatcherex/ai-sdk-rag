import { and, avg, desc, eq, sql, sum } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateText } from 'ai';

import { db } from '@/lib/db';
import { contentPieceMetric, abVariant, contentPiece } from '@/db/schema';
import { chatModel } from '@/lib/ai';
import type {
  ContentPieceMetric,
  TrackMetricInput,
  AbVariant,
  CreateAbVariantInput,
  ContentPerformanceSummary,
  PerformanceAnalysis,
  MetricPlatform,
} from './types';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapMetric(row: typeof contentPieceMetric.$inferSelect): ContentPieceMetric {
  return {
    id: row.id,
    contentPieceId: row.contentPieceId,
    userId: row.userId,
    platform: row.platform as MetricPlatform,
    views: row.views,
    clicks: row.clicks,
    impressions: row.impressions,
    engagement: row.engagement,
    conversions: row.conversions,
    ctr: row.ctr ?? null,
    notes: row.notes ?? null,
    measuredAt: row.measuredAt,
    createdAt: row.createdAt,
  };
}

function mapVariant(row: typeof abVariant.$inferSelect): AbVariant {
  return {
    id: row.id,
    contentPieceId: row.contentPieceId,
    userId: row.userId,
    variantLabel: row.variantLabel,
    body: row.body,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    isWinner: row.isWinner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export async function trackMetric(
  userId: string,
  input: TrackMetricInput,
): Promise<ContentPieceMetric> {
  const ctr =
    input.impressions && input.clicks
      ? input.clicks / input.impressions
      : null;

  const rows = await db
    .insert(contentPieceMetric)
    .values({
      id: nanoid(),
      userId,
      contentPieceId: input.contentPieceId,
      platform: input.platform,
      views: input.views ?? 0,
      clicks: input.clicks ?? 0,
      impressions: input.impressions ?? 0,
      engagement: input.engagement ?? 0,
      conversions: input.conversions ?? 0,
      ctr,
      notes: input.notes ?? null,
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
    })
    .returning();

  return mapMetric(rows[0]);
}

export async function getContentMetrics(
  userId: string,
  contentPieceId: string,
): Promise<ContentPieceMetric[]> {
  const rows = await db
    .select()
    .from(contentPieceMetric)
    .where(
      and(
        eq(contentPieceMetric.userId, userId),
        eq(contentPieceMetric.contentPieceId, contentPieceId),
      ),
    )
    .orderBy(desc(contentPieceMetric.measuredAt));

  return rows.map(mapMetric);
}

export async function getContentPerformanceSummary(
  userId: string,
  contentPieceId: string,
): Promise<ContentPerformanceSummary> {
  const metrics = await getContentMetrics(userId, contentPieceId);

  const totals = metrics.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      clicks: acc.clicks + m.clicks,
      impressions: acc.impressions + m.impressions,
      engagement: acc.engagement + m.engagement,
      conversions: acc.conversions + m.conversions,
    }),
    { views: 0, clicks: 0, impressions: 0, engagement: 0, conversions: 0 },
  );

  const avgCtr =
    totals.impressions > 0 ? totals.clicks / totals.impressions : null;

  // Group by platform
  const platformMap = new Map<MetricPlatform, typeof totals>();
  for (const m of metrics) {
    const p = m.platform;
    const existing = platformMap.get(p) ?? {
      views: 0, clicks: 0, impressions: 0, engagement: 0, conversions: 0,
    };
    platformMap.set(p, {
      views: existing.views + m.views,
      clicks: existing.clicks + m.clicks,
      impressions: existing.impressions + m.impressions,
      engagement: existing.engagement + m.engagement,
      conversions: existing.conversions + m.conversions,
    });
  }

  const byPlatform = Array.from(platformMap.entries()).map(([platform, v]) => ({
    platform,
    ...v,
  }));

  return {
    contentPieceId,
    totalViews: totals.views,
    totalClicks: totals.clicks,
    totalImpressions: totals.impressions,
    totalEngagement: totals.engagement,
    totalConversions: totals.conversions,
    avgCtr,
    byPlatform,
    metrics,
  };
}

export async function getUserRecentMetrics(
  userId: string,
  limit = 20,
): Promise<ContentPieceMetric[]> {
  const rows = await db
    .select()
    .from(contentPieceMetric)
    .where(eq(contentPieceMetric.userId, userId))
    .orderBy(desc(contentPieceMetric.measuredAt))
    .limit(limit);

  return rows.map(mapMetric);
}

export async function deleteMetric(userId: string, id: string): Promise<void> {
  await db
    .delete(contentPieceMetric)
    .where(and(eq(contentPieceMetric.id, id), eq(contentPieceMetric.userId, userId)));
}

// ── A/B Variants ──────────────────────────────────────────────────────────────

export async function createAbVariant(
  userId: string,
  input: CreateAbVariantInput,
): Promise<AbVariant> {
  const rows = await db
    .insert(abVariant)
    .values({
      id: nanoid(),
      userId,
      contentPieceId: input.contentPieceId,
      variantLabel: input.variantLabel,
      body: input.body,
    })
    .returning();

  return mapVariant(rows[0]);
}

export async function getAbVariants(
  userId: string,
  contentPieceId: string,
): Promise<AbVariant[]> {
  const rows = await db
    .select()
    .from(abVariant)
    .where(
      and(
        eq(abVariant.userId, userId),
        eq(abVariant.contentPieceId, contentPieceId),
      ),
    )
    .orderBy(abVariant.variantLabel);

  return rows.map(mapVariant);
}

export async function updateAbVariant(
  userId: string,
  id: string,
  data: Partial<Pick<AbVariant, 'impressions' | 'clicks' | 'conversions' | 'isWinner' | 'body'>>,
): Promise<AbVariant | null> {
  const rows = await db
    .update(abVariant)
    .set({
      ...(data.impressions !== undefined ? { impressions: data.impressions } : {}),
      ...(data.clicks !== undefined ? { clicks: data.clicks } : {}),
      ...(data.conversions !== undefined ? { conversions: data.conversions } : {}),
      ...(data.isWinner !== undefined ? { isWinner: data.isWinner } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
    })
    .where(and(eq(abVariant.id, id), eq(abVariant.userId, userId)))
    .returning();

  return rows[0] ? mapVariant(rows[0]) : null;
}

export async function deleteAbVariant(userId: string, id: string): Promise<void> {
  await db
    .delete(abVariant)
    .where(and(eq(abVariant.id, id), eq(abVariant.userId, userId)));
}

// ── AI Performance Analysis ───────────────────────────────────────────────────

export async function analyzeContentPerformance(
  userId: string,
  contentPieceId: string,
): Promise<PerformanceAnalysis> {
  const [summary, piece] = await Promise.all([
    getContentPerformanceSummary(userId, contentPieceId),
    db
      .select({ title: contentPiece.title, contentType: contentPiece.contentType })
      .from(contentPiece)
      .where(eq(contentPiece.id, contentPieceId))
      .limit(1),
  ]);

  const pieceInfo = piece[0];
  const platformLines = summary.byPlatform
    .map(
      (p) =>
        `- ${p.platform}: ${p.views} views, ${p.clicks} clicks, ${p.engagement} engagement, ${p.conversions} conversions`,
    )
    .join('\n');

  const prompt = `You are a content performance analyst. Analyze the following content metrics and provide actionable insights.

Content: "${pieceInfo?.title ?? 'Unknown'}" (${pieceInfo?.contentType ?? 'unknown type'})

Overall Performance:
- Total Views: ${summary.totalViews}
- Total Clicks: ${summary.totalClicks}
- Total Impressions: ${summary.totalImpressions}
- Total Engagement: ${summary.totalEngagement}
- Total Conversions: ${summary.totalConversions}
- Average CTR: ${summary.avgCtr != null ? (summary.avgCtr * 100).toFixed(2) + '%' : 'N/A'}

By Platform:
${platformLines || '- No platform breakdown available'}

Respond in this exact JSON format:
{
  "summary": "2-3 sentence performance overview",
  "topInsights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "score": 75
}

Score should be 0-100 based on overall performance quality.`;

  const { text } = await generateText({
    model: chatModel,
    prompt,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]) as PerformanceAnalysis;
    return {
      summary: parsed.summary ?? '',
      topInsights: Array.isArray(parsed.topInsights) ? parsed.topInsights : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
    };
  } catch {
    return {
      summary: text.slice(0, 300),
      topInsights: [],
      recommendations: [],
      score: 50,
    };
  }
}
