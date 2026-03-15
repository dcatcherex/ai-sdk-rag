/**
 * Trend service — fetches and caches social media trends.
 *
 * Data sources:
 *  - TikTok: Apify actor `clockworks/tiktok-scraper` (hashtag search)
 *  - Instagram: Apify actor `apify/instagram-hashtag-scraper`
 *
 * Cache strategy:
 *  - One row per (weekKey, platform, industry) in `trend_cache` table
 *  - Weekly scheduled refresh via cron for all industries
 *  - On-demand refresh available as a premium feature (costs credits)
 */

import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { trendCache } from '@/db/schema';
import { env } from '@/lib/env';
import { getMockTrends } from './mock-trends';
import type { TrendItem, TrendPlatform, GetTrendsInput, GetTrendsResult } from './types';

// ── Week key helpers ──────────────────────────────────────────────────────────

/** Returns ISO week string like '2026-W11' */
function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Industry keyword mapping ──────────────────────────────────────────────────

const INDUSTRY_HASHTAGS: Record<string, string[]> = {
  food: ['foodtok', 'foodie', 'foodphotography', 'recipe', 'cooking'],
  fitness: ['gymtok', 'workout', 'fitness', 'gym', 'fitnessmotivation'],
  fashion: ['fashion', 'ootd', 'style', 'outfitoftheday', 'fashiontok'],
  beauty: ['beautytok', 'makeup', 'skincare', 'grwm', 'beautytips'],
  travel: ['travel', 'traveltok', 'wanderlust', 'travelphotography', 'explore'],
  wellness: ['wellness', 'selfcare', 'mentalhealth', 'mindfulness', 'meditation'],
  tech: ['tech', 'techtok', 'productivity', 'gadgets', 'workfromhome'],
  ecommerce: ['smallbusiness', 'entrepreneur', 'shopsmall', 'businessowner'],
  lifestyle: ['lifestyle', 'dayinmylife', 'vlog', 'aesthetic'],
  all: ['trending', 'foryou', 'viral', 'fyp', 'explore'],
};

// ── Apify fetching ────────────────────────────────────────────────────────────

async function fetchTikTokTrends(industry: string): Promise<TrendItem[]> {
  const hashtags = INDUSTRY_HASHTAGS[industry] ?? INDUSTRY_HASHTAGS.all;
  const token = env.APIFY_API_TOKEN;
  if (!token) return [];

  const items: TrendItem[] = [];

  for (const hashtag of hashtags.slice(0, 3)) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hashtags: [hashtag],
            resultsPerPage: 5,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
          }),
        },
      );

      if (!runRes.ok) continue;
      const data = (await runRes.json()) as Array<{
        id?: string;
        text?: string;
        diggCount?: number;
        shareCount?: number;
        playCount?: number;
        hashtags?: Array<{ name: string }>;
        webVideoUrl?: string;
        covers?: { default?: string };
      }>;

      for (const post of data.slice(0, 3)) {
        items.push({
          id: `tt-apify-${post.id ?? nanoid(8)}`,
          platform: 'tiktok',
          title: `#${hashtag}`,
          description: post.text?.slice(0, 200) ?? `Trending TikTok content in #${hashtag}`,
          postCount: post.playCount,
          growthPercent: undefined,
          contentIdeas: [],
          hashtags: (post.hashtags ?? []).map((h) => `#${h.name}`).slice(0, 5),
          contentType: 'video',
          industry,
          exampleUrl: post.webVideoUrl,
          thumbnailUrl: post.covers?.default,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal — skip this hashtag
    }
  }

  return items;
}

async function fetchInstagramTrends(industry: string): Promise<TrendItem[]> {
  const hashtags = INDUSTRY_HASHTAGS[industry] ?? INDUSTRY_HASHTAGS.all;
  const token = env.APIFY_API_TOKEN;
  if (!token) return [];

  const items: TrendItem[] = [];

  for (const hashtag of hashtags.slice(0, 3)) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hashtags: [hashtag],
            resultsLimit: 5,
          }),
        },
      );

      if (!runRes.ok) continue;
      const data = (await runRes.json()) as Array<{
        id?: string;
        caption?: string;
        likesCount?: number;
        commentsCount?: number;
        type?: string;
        displayUrl?: string;
        url?: string;
        hashtags?: string[];
      }>;

      for (const post of data.slice(0, 3)) {
        items.push({
          id: `ig-apify-${post.id ?? nanoid(8)}`,
          platform: 'instagram',
          title: `#${hashtag}`,
          description: post.caption?.slice(0, 200) ?? `Trending Instagram content in #${hashtag}`,
          postCount: post.likesCount,
          growthPercent: undefined,
          contentIdeas: [],
          hashtags: (post.hashtags ?? []).map((h) => `#${h}`).slice(0, 5),
          contentType: post.type === 'Video' ? 'reel' : 'image',
          industry,
          exampleUrl: post.url,
          thumbnailUrl: post.displayUrl,
          fetchedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal — skip this hashtag
    }
  }

  return items;
}

// ── Cache read/write ──────────────────────────────────────────────────────────

async function readFromCache(
  platform: TrendPlatform,
  industry: string,
  weekKey: string,
): Promise<TrendItem[] | null> {
  const rows = await db
    .select()
    .from(trendCache)
    .where(
      and(
        eq(trendCache.platform, platform),
        eq(trendCache.industry, industry),
        eq(trendCache.weekKey, weekKey),
      ),
    )
    .limit(1);

  if (!rows.length) return null;
  return rows[0].items as TrendItem[];
}

async function writeToCache(
  platform: TrendPlatform,
  industry: string,
  weekKey: string,
  items: TrendItem[],
): Promise<void> {
  const id = nanoid();
  await db
    .insert(trendCache)
    .values({ id, platform, industry, items, weekKey, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [trendCache.weekKey, trendCache.platform, trendCache.industry],
      set: { items, fetchedAt: new Date() },
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTrends(input: GetTrendsInput): Promise<GetTrendsResult> {
  const { platform, industry = 'all', forceRefresh = false } = input;
  const weekKey = getWeekKey();

  // Use mock data in dev/testing
  if (env.USE_MOCK_TRENDS === 'true') {
    const items = getMockTrends(platform, industry);
    return { items, cachedAt: new Date().toISOString(), weekKey, isMock: true };
  }

  const platforms: TrendPlatform[] = platform ? [platform] : ['tiktok', 'instagram'];
  const allItems: TrendItem[] = [];
  let cachedAt = new Date().toISOString();

  for (const p of platforms) {
    if (!forceRefresh) {
      const cached = await readFromCache(p, industry, weekKey);
      if (cached) {
        allItems.push(...cached);
        continue;
      }
    }

    // Fetch fresh from Apify
    const fresh = p === 'tiktok'
      ? await fetchTikTokTrends(industry)
      : await fetchInstagramTrends(industry);

    if (fresh.length > 0) {
      await writeToCache(p, industry, weekKey, fresh);
      allItems.push(...fresh);
      cachedAt = new Date().toISOString();
    } else {
      // Fallback to mock if Apify returned nothing
      allItems.push(...getMockTrends(p, industry));
    }
  }

  return { items: allItems, cachedAt, weekKey, isMock: false };
}

/** Refresh all industries for a given platform — called by cron */
export async function refreshAllTrends(): Promise<{ refreshed: number; errors: number }> {
  const industries = Object.keys(INDUSTRY_HASHTAGS);
  const platforms: TrendPlatform[] = ['tiktok', 'instagram'];
  const weekKey = getWeekKey();
  let refreshed = 0;
  let errors = 0;

  for (const platform of platforms) {
    for (const industry of industries) {
      try {
        const fresh = platform === 'tiktok'
          ? await fetchTikTokTrends(industry)
          : await fetchInstagramTrends(industry);

        if (fresh.length > 0) {
          await writeToCache(platform, industry, weekKey, fresh);
          refreshed++;
        }
      } catch {
        errors++;
      }
    }
  }

  return { refreshed, errors };
}

export const TREND_INDUSTRIES = Object.keys(INDUSTRY_HASHTAGS);
