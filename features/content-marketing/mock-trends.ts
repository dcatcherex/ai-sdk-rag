/**
 * Mock trend data for local dev / testing.
 * Activated when USE_MOCK_TRENDS=true in .env.local
 */

import type { TrendItem } from './types';

export const MOCK_TRENDS: TrendItem[] = [
  // ── TikTok Trends ──────────────────────────────────────────────────────────
  {
    id: 'tt-trend-001',
    platform: 'tiktok',
    title: '#FoodAesthetic',
    description: 'Highly stylized overhead food shots with moody lighting and rich colors — cafes and home cooks going viral.',
    postCount: 4_200_000,
    growthPercent: 38,
    contentIdeas: [
      'Overhead flat-lay of your signature dish with moody lighting',
      'Time-lapse of plating a dessert with dramatic reveal',
      '"What I eat in a day" aesthetic montage',
    ],
    hashtags: ['#FoodAesthetic', '#FoodTok', '#FoodieVibes', '#PlatingGoals'],
    contentType: 'video',
    industry: 'food',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'tt-trend-002',
    platform: 'tiktok',
    title: '#GymRat POV',
    description: 'First-person perspective gym content — followers living the workout journey with the creator.',
    postCount: 2_800_000,
    growthPercent: 52,
    contentIdeas: [
      'POV: You just hit a new PR — show the weight, the celebration',
      'Morning gym routine "grwm" (get ready with me) from parking lot to first set',
      'POV: Helping a gym newbie with their form',
    ],
    hashtags: ['#GymRat', '#GymTok', '#FitnessMotivation', '#WorkoutPOV', '#GymLife'],
    contentType: 'video',
    industry: 'fitness',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'tt-trend-003',
    platform: 'tiktok',
    title: '#GRWM (Get Ready With Me)',
    description: 'GRWM videos across beauty, fashion, and lifestyle — viewers love the conversational, candid format.',
    postCount: 8_500_000,
    growthPercent: 21,
    contentIdeas: [
      'GRWM for a big client meeting — outfit, makeup, mindset tips',
      'GRWM morning routine that took me from broke to thriving',
      'GRWM for a date night — storytelling while getting ready',
    ],
    hashtags: ['#GRWM', '#GetReadyWithMe', '#GRWMroutine', '#BeautyTok'],
    contentType: 'video',
    industry: 'fashion',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'tt-trend-004',
    platform: 'tiktok',
    title: '#SilentWalking',
    description: 'Walking outside with no phone, no music, no podcasts — creators sharing the mental clarity experience.',
    postCount: 1_100_000,
    growthPercent: 67,
    contentIdeas: [
      'Try silent walking for 7 days — document what you noticed',
      'What I thought about during my 30-minute silent walk',
      'The mental health shift from putting down my AirPods',
    ],
    hashtags: ['#SilentWalking', '#MentalHealth', '#MindfulLiving', '#WalkingTok'],
    contentType: 'video',
    industry: 'wellness',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'tt-trend-005',
    platform: 'tiktok',
    title: '#SmallBusinessTok',
    description: 'Behind-the-scenes of small business owners — packing orders, making products, honest journey content.',
    postCount: 6_300_000,
    growthPercent: 29,
    contentIdeas: [
      'Pack orders with me — show the full fulfillment process',
      'How I built my small business from $0 to 5 figures',
      'The real cost breakdown of making one product',
    ],
    hashtags: ['#SmallBusiness', '#SmallBusinessTok', '#Entrepreneur', '#BusinessOwner', '#PackWithMe'],
    contentType: 'video',
    industry: 'ecommerce',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'tt-trend-006',
    platform: 'tiktok',
    title: '#CottageCore Aesthetic',
    description: 'Romanticizing simple, rural life — baking, gardening, vintage clothing, and cozy interiors.',
    postCount: 3_700_000,
    growthPercent: 18,
    contentIdeas: [
      'A day in my cottage-inspired life — morning baking to evening reading',
      'Building a cottagecore capsule wardrobe for under $100',
      'Creating a cozy corner in your apartment',
    ],
    hashtags: ['#CottageCore', '#CottageCoreFashion', '#SlowLiving', '#CozyAesthetic'],
    contentType: 'video',
    industry: 'lifestyle',
    fetchedAt: new Date().toISOString(),
  },

  // ── Instagram Trends ───────────────────────────────────────────────────────
  {
    id: 'ig-trend-001',
    platform: 'instagram',
    title: '#TravelDump',
    description: 'Casual, unfiltered travel photo dumps outperforming polished travel photography — authenticity wins.',
    postCount: 9_200_000,
    growthPercent: 44,
    contentIdeas: [
      'Post a 10-photo dump from your last trip — no editing required',
      '"Things only locals know about [city]" carousel',
      'Honest travel review: the good, the bad, and the ugly',
    ],
    hashtags: ['#TravelDump', '#TravelPhotography', '#Wanderlust', '#TravelGram', '#ExploreMore'],
    contentType: 'image',
    industry: 'travel',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'ig-trend-002',
    platform: 'instagram',
    title: 'Soft Life Aesthetic',
    description: 'Prioritizing comfort, luxury, and self-care over hustle culture — resonates with millennial and Gen Z audiences.',
    postCount: 2_400_000,
    growthPercent: 35,
    contentIdeas: [
      'My soft morning routine — silk PJs, matcha, and journaling',
      'What "soft life" actually means to me — carousel with personal story',
      'Soft life on a budget: affordable ways to feel luxurious',
    ],
    hashtags: ['#SoftLife', '#SoftLifeAesthetic', '#SelfCare', '#LuxuryLifestyle', '#SlowMorning'],
    contentType: 'image',
    industry: 'wellness',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'ig-trend-003',
    platform: 'instagram',
    title: '#BeautyCarousel',
    description: 'Swipeable before/after beauty transformations and product reviews driving massive saves and shares.',
    postCount: 5_800_000,
    growthPercent: 27,
    contentIdeas: [
      '5-slide routine breakdown: each slide = one step with product',
      'Before/after swipe with the exact products used',
      '"What\'s in my makeup bag" flat-lay carousel',
    ],
    hashtags: ['#BeautyTips', '#MakeupCarousel', '#SkincareTips', '#BeautyRoutine', '#GRWM'],
    contentType: 'image',
    industry: 'beauty',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'ig-trend-004',
    platform: 'instagram',
    title: 'Pinterest-Style Reels',
    description: 'Short, aesthetic reels (15–30s) with trending audio that feel like animated Pinterest boards.',
    postCount: 4_100_000,
    growthPercent: 61,
    contentIdeas: [
      'Aesthetic morning routine reel with trending lo-fi audio',
      '"Things that make me feel like the main character" reel',
      'Seasonal outfit inspiration reel with Pinterest-style transitions',
    ],
    hashtags: ['#PinterestAesthetic', '#Reels', '#AestheticReels', '#MainCharacter'],
    contentType: 'reel',
    industry: 'lifestyle',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'ig-trend-005',
    platform: 'instagram',
    title: '#FoodPhotography Flat Lay',
    description: 'Clean, minimal overhead food shots with props — still dominating the food niche on Instagram.',
    postCount: 7_600_000,
    growthPercent: 15,
    contentIdeas: [
      'Seasonal ingredient flat lay — spring produce arranged artfully',
      'Recipe carousel with flat-lay hero shot on slide 1',
      '"Everything I ate this week" grid-friendly food dump',
    ],
    hashtags: ['#FoodPhotography', '#FlatLay', '#FoodStyling', '#FoodBlogger', '#InstaFood'],
    contentType: 'image',
    industry: 'food',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'ig-trend-006',
    platform: 'instagram',
    title: '#WorkFromHome Setup',
    description: 'Desk setup reveals and WFH productivity tips — tech + aesthetic blend driving massive engagement.',
    postCount: 1_900_000,
    growthPercent: 42,
    contentIdeas: [
      'My WFH desk setup reveal — full gear list in caption',
      'How I stay productive working from home — carousel tips',
      '"My home office glow-up" before/after swipe post',
    ],
    hashtags: ['#WorkFromHome', '#DeskSetup', '#HomeOffice', '#Productivity', '#RemoteWork'],
    contentType: 'image',
    industry: 'tech',
    fetchedAt: new Date().toISOString(),
  },
];

/** Filter mock trends by platform and/or industry */
export function getMockTrends(platform?: string, industry?: string): TrendItem[] {
  return MOCK_TRENDS.filter((t) => {
    if (platform && t.platform !== platform) return false;
    if (industry && industry !== 'all' && t.industry !== industry) return false;
    return true;
  });
}
