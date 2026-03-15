import type { SocialPlatform } from './types';

export const PLATFORMS: { id: SocialPlatform; label: string; color: string; oauthPlatform: string }[] = [
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-500', oauthPlatform: 'meta' },
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-600', oauthPlatform: 'meta' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-black dark:bg-zinc-800', oauthPlatform: 'tiktok' },
];

export const TONES = ['engaging', 'professional', 'casual', 'funny', 'inspirational', 'educational'];

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};
