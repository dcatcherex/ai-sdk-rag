/**
 * Trend service — fetches and caches social media trends.
 *
 * Data sources:
 *  - TikTok:    Apify actor `clockworks/tiktok-scraper`
 *               • industry='all'  → trending feed (searchSection:'trending')
 *               • specific industry → hashtag search + audio extraction
 *  - Instagram: Apify actor `apify/instagram-hashtag-scraper`
 *  - YouTube:   Apify actor `apify/youtube-scraper` (trending feed)
 *
 * Enhancements vs v1:
 *  - growthPercent computed by comparing this week vs previous week's cache
 *  - contentIdeas AI-generated in one batch call after fetching
 *  - trendingAudio extracted from TikTok posts
 *  - YouTube added as third platform
 *
 * Cache strategy:
 *  - One row per (weekKey, platform, industry) in `trend_cache` table
 *  - Weekly scheduled refresh via cron for all industries
 *  - On-demand refresh available as a premium feature (costs credits)
 */

import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { trendCache } from '@/db/schema';
import { env } from '@/lib/env';
import { getMockTrends } from './mock-trends';
import type { TrendItem, TrendPlatform, GetTrendsInput, GetTrendsResult } from './types';

// ── Model ─────────────────────────────────────────────────────────────────────

const TREND_AI_MODEL = 'google/gemini-2.5-flash-lite' as Parameters<typeof generateText>[0]['model'];

// ── Week key helpers ──────────────────────────────────────────────────────────

function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getPreviousWeekKey(weekKey: string): string {
  // Parse '2026-W15' → compute date of that Monday → subtract 7 days → new weekKey
  const [yearStr, weekPart] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  // ISO week 1 Monday = Jan 4 or first Thursday's Monday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekOneMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const thisMonday = new Date(weekOneMonday.getTime() + (week - 1) * 7 * 86400000);
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  return getWeekKey(prevMonday);
}

// ── Industry hashtag mapping ──────────────────────────────────────────────────

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

// ── Apify helpers ─────────────────────────────────────────────────────────────

async function runApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
): Promise<T[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=60`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) return [];
  return res.json() as Promise<T[]>;
}

// ── TikTok scraping ───────────────────────────────────────────────────────────

type ApifyTikTokPost = {
  id?: string;
  text?: string;
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
  hashtags?: Array<{ name: string }>;
  webVideoUrl?: string;
  covers?: { default?: string };
  music?: { title?: string; authorName?: string; playUrl?: string };
};

async function fetchTikTokTrends(industry: string): Promise<TrendItem[]> {
  const token = env.APIFY_API_TOKEN;
  if (!token) return [];

  const items: TrendItem[] = [];

  try {
    let posts: ApifyTikTokPost[];

    if (industry === 'all') {
      // Use the actual trending feed — no hashtag bias
      posts = await runApifyActor<ApifyTikTokPost>(
        'clockworks~tiktok-scraper',
        { searchSection: 'trending', maxVideos: 24, shouldDownloadVideos: false, shouldDownloadCovers: false },
        token,
      );
    } else {
      // Hashtag search for specific industry
      const hashtags = INDUSTRY_HASHTAGS[industry] ?? INDUSTRY_HASHTAGS.all;
      posts = [];
      for (const hashtag of hashtags.slice(0, 3)) {
        const batch = await runApifyActor<ApifyTikTokPost>(
          'clockworks~tiktok-scraper',
          { hashtags: [hashtag], resultsPerPage: 5, shouldDownloadVideos: false, shouldDownloadCovers: false },
          token,
        );
        posts.push(...batch.slice(0, 3));
      }
    }

    // Group by dominant hashtag to create trend items
    const hashtagGroups = new Map<string, ApifyTikTokPost[]>();
    for (const post of posts) {
      const tag = post.hashtags?.[0]?.name ?? (industry === 'all' ? 'trending' : industry);
      const group = hashtagGroups.get(tag) ?? [];
      group.push(post);
      hashtagGroups.set(tag, group);
    }

    for (const [hashtag, groupPosts] of hashtagGroups.entries()) {
      if (items.length >= 8) break;
      const topPost = groupPosts[0];
      const totalViews = groupPosts.reduce((sum, p) => sum + (p.playCount ?? 0), 0);
      const allHashtags = [
        ...new Set(groupPosts.flatMap((p) => (p.hashtags ?? []).map((h) => `#${h.name}`))),
      ].slice(0, 6);

      // Pick the post with the most engagement for the example URL
      const bestPost = groupPosts.reduce((best, p) =>
        (p.playCount ?? 0) > (best.playCount ?? 0) ? p : best, topPost);

      const music = bestPost.music;

      items.push({
        id: `tt-${hashtag}-${nanoid(6)}`,
        platform: 'tiktok',
        title: `#${hashtag}`,
        description: topPost.text?.slice(0, 200) ?? `Trending TikTok content in #${hashtag}`,
        postCount: totalViews,
        growthPercent: undefined,
        contentIdeas: [],
        hashtags: allHashtags.length > 0 ? allHashtags : [`#${hashtag}`],
        contentType: 'video',
        industry,
        exampleUrl: bestPost.webVideoUrl,
        thumbnailUrl: bestPost.covers?.default,
        trendingAudio:
          music?.title
            ? { title: music.title, author: music.authorName ?? '', url: music.playUrl }
            : undefined,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Non-fatal — return empty so caller falls back to mock
  }

  return items;
}

// ── Instagram scraping ────────────────────────────────────────────────────────

type ApifyInstagramPost = {
  id?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  type?: string;
  displayUrl?: string;
  url?: string;
  hashtags?: string[];
};

async function fetchInstagramTrends(industry: string): Promise<TrendItem[]> {
  const token = env.APIFY_API_TOKEN;
  if (!token) return [];

  const hashtags = INDUSTRY_HASHTAGS[industry] ?? INDUSTRY_HASHTAGS.all;
  const items: TrendItem[] = [];

  for (const hashtag of hashtags.slice(0, 3)) {
    try {
      const posts = await runApifyActor<ApifyInstagramPost>(
        'apify~instagram-hashtag-scraper',
        { hashtags: [hashtag], resultsLimit: 6 },
        token,
      );

      if (!posts.length) continue;

      const totalLikes = posts.reduce((s, p) => s + (p.likesCount ?? 0), 0);
      const allHashtags = [
        ...new Set(posts.flatMap((p) => (p.hashtags ?? []).map((h) => `#${h}`))),
      ].slice(0, 6);

      const bestPost = posts.reduce((best, p) =>
        (p.likesCount ?? 0) > (best.likesCount ?? 0) ? p : best, posts[0]);

      const dominantType = posts.filter((p) => p.type === 'Video').length > posts.length / 2
        ? 'reel'
        : 'image';

      items.push({
        id: `ig-${hashtag}-${nanoid(6)}`,
        platform: 'instagram',
        title: `#${hashtag}`,
        description: posts[0].caption?.slice(0, 200) ?? `Trending Instagram content in #${hashtag}`,
        postCount: totalLikes,
        growthPercent: undefined,
        contentIdeas: [],
        hashtags: allHashtags.length > 0 ? allHashtags : [`#${hashtag}`],
        contentType: dominantType,
        industry,
        exampleUrl: bestPost.url,
        thumbnailUrl: bestPost.displayUrl,
        fetchedAt: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }
  }

  return items;
}

// ── YouTube scraping ──────────────────────────────────────────────────────────

type ApifyYouTubeVideo = {
  id?: string;
  title?: string;
  url?: string;
  channelName?: string;
  channelUrl?: string;
  viewCount?: number;
  numberOfViews?: number;
  likesCount?: number;
  description?: string;
  duration?: string;
  thumbnailUrl?: string;
  hashtags?: string[];
  date?: string;
  uploadDate?: string;
};

async function fetchYouTubeTrends(industry: string): Promise<TrendItem[]> {
  const token = env.APIFY_API_TOKEN;
  if (!token) return [];

  // YouTube trending category URLs
  const YOUTUBE_CATEGORY_URLS: Record<string, string> = {
    all: 'https://www.youtube.com/feed/trending',
    tech: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0IBQ%3D',     // Science & Tech
    fashion: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0IBo%3D',   // Howto & Style
    beauty: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0IBo%3D',    // Howto & Style
    food: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0IBo%3D',      // Howto & Style
    fitness: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0ABE%3D',   // Sports
    travel: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0ABM%3D',    // Travel & Events
    gaming: 'https://www.youtube.com/feed/trending?bp=4gINGgt2aWRlb3NfY2F0ABI%3D',    // Gaming
  };

  const url = YOUTUBE_CATEGORY_URLS[industry] ?? YOUTUBE_CATEGORY_URLS.all;

  try {
    const videos = await runApifyActor<ApifyYouTubeVideo>(
      'apify~youtube-scraper',
      {
        startUrls: [{ url }],
        maxResults: 20,
        type: 'videos',
      },
      token,
    );

    return videos.slice(0, 8).map((v) => {
      const views = v.viewCount ?? v.numberOfViews ?? 0;
      const tags = (v.hashtags ?? []).map((h) => h.startsWith('#') ? h : `#${h}`).slice(0, 5);

      return {
        id: `yt-${v.id ?? nanoid(8)}`,
        platform: 'youtube',
        title: v.title ?? 'Trending video',
        description: v.description?.slice(0, 200) ?? `Trending YouTube video by ${v.channelName ?? 'creator'}`,
        postCount: views,
        growthPercent: undefined,
        contentIdeas: [],
        hashtags: tags,
        contentType: 'video',
        industry,
        exampleUrl: v.url,
        thumbnailUrl: v.thumbnailUrl,
        fetchedAt: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// ── Growth rate from previous week ───────────────────────────────────────────

async function applyGrowthRate(
  items: TrendItem[],
  platform: TrendPlatform,
  industry: string,
  weekKey: string,
): Promise<TrendItem[]> {
  const prevWeekKey = getPreviousWeekKey(weekKey);
  const prevItems = await readFromCache(platform, industry, prevWeekKey);
  if (!prevItems || prevItems.length === 0) return items;

  return items.map((item) => {
    const prev = prevItems.find((p) => p.title === item.title);
    if (prev?.postCount && item.postCount && prev.postCount > 0) {
      const pct = Math.round(((item.postCount - prev.postCount) / prev.postCount) * 100);
      return { ...item, growthPercent: Math.max(-99, Math.min(999, pct)) };
    }
    return item;
  });
}

// ── AI content ideas ──────────────────────────────────────────────────────────

async function enrichWithContentIdeas(items: TrendItem[]): Promise<TrendItem[]> {
  const needsIdeas = items.filter((t) => t.contentIdeas.length === 0);
  if (needsIdeas.length === 0) return items;

  try {
    const prompt = `You are a social media content strategist. For each trending topic below, generate exactly 3 short, actionable content ideas (each under 120 characters). Ideas should be specific and immediately usable.

Trends:
${needsIdeas.map((t, i) => `${i + 1}. "${t.title}" on ${t.platform} — ${t.description}`).join('\n')}

Respond ONLY with a JSON array (no markdown fences):
[{"index":1,"ideas":["idea one","idea two","idea three"]},{"index":2,"ideas":[...]},...]`;

    const { text } = await generateText({ model: TREND_AI_MODEL, prompt });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return items;

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; ideas: string[] }>;
    const ideaMap = new Map(parsed.map((r) => [r.index, r.ideas]));

    const enriched = new Map(
      needsIdeas.map((t, i) => [t.id, ideaMap.get(i + 1) ?? []]),
    );

    return items.map((t) =>
      enriched.has(t.id) ? { ...t, contentIdeas: enriched.get(t.id)! } : t,
    );
  } catch {
    // Non-fatal — return items without ideas rather than failing
    return items;
  }
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

// ── Fetch + enrich pipeline ───────────────────────────────────────────────────

async function fetchFreshAndEnrich(
  platform: TrendPlatform,
  industry: string,
  weekKey: string,
): Promise<TrendItem[]> {
  let fresh: TrendItem[];

  if (platform === 'tiktok') {
    fresh = await fetchTikTokTrends(industry);
  } else if (platform === 'instagram') {
    fresh = await fetchInstagramTrends(industry);
  } else {
    fresh = await fetchYouTubeTrends(industry);
  }

  if (fresh.length === 0) {
    return getMockTrends(platform, industry);
  }

  // Apply growth rate from previous week
  fresh = await applyGrowthRate(fresh, platform, industry, weekKey);

  // AI-generate content ideas
  fresh = await enrichWithContentIdeas(fresh);

  return fresh;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getTrends(input: GetTrendsInput): Promise<GetTrendsResult> {
  const { platform, industry = 'all', forceRefresh = false } = input;
  const weekKey = getWeekKey();

  if (env.USE_MOCK_TRENDS === 'true') {
    const items = getMockTrends(platform, industry);
    return { items, cachedAt: new Date().toISOString(), weekKey, isMock: true };
  }

  const platforms: TrendPlatform[] = platform ? [platform] : ['tiktok', 'instagram', 'youtube'];
  const allItems: TrendItem[] = [];
  const cachedAt = new Date().toISOString();

  for (const p of platforms) {
    if (!forceRefresh) {
      const cached = await readFromCache(p, industry, weekKey);
      if (cached) {
        allItems.push(...cached);
        continue;
      }
    }

    const fresh = await fetchFreshAndEnrich(p, industry, weekKey);
    await writeToCache(p, industry, weekKey, fresh);
    allItems.push(...fresh);
  }

  return { items: allItems, cachedAt, weekKey, isMock: false };
}

/** Refresh all industries for all platforms — called by weekly cron */
export async function refreshAllTrends(): Promise<{ refreshed: number; errors: number }> {
  const industries = Object.keys(INDUSTRY_HASHTAGS);
  const platforms: TrendPlatform[] = ['tiktok', 'instagram', 'youtube'];
  const weekKey = getWeekKey();
  let refreshed = 0;
  let errors = 0;

  for (const platform of platforms) {
    for (const industry of industries) {
      try {
        const fresh = await fetchFreshAndEnrich(platform, industry, weekKey);
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
