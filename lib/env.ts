import { z } from 'zod';

const envSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().min(1),
  /** Meta (Facebook + Instagram) app credentials */
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  /** TikTok app credentials */
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  /** Base URL for OAuth redirect URIs (e.g. https://yourapp.com) */
  BETTER_AUTH_URL: z.string().optional(),
  /** Secret used to authorize cron job requests (set automatically by Vercel) */
  CRON_SECRET: z.string().optional(),
  /** Apify API token for social trend scraping */
  APIFY_API_TOKEN: z.string().optional(),
  /** Set to 'true' to use mock trend data instead of calling Apify (for local dev/testing) */
  USE_MOCK_TRENDS: z.string().optional(),
  /** Cloudflare Pages deployment (optional — website builder feature) */
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_PAGES_API_TOKEN: z.string().optional(),
  CLOUDFLARE_SITE_SUBDOMAIN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
