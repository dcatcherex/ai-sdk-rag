/**
 * Initiate OAuth flow for a social platform.
 * GET /api/social/connect/[platform]?returnTo=/tools/content-marketing
 *
 * Redirects the user to the platform's OAuth authorization page.
 * Stores a signed state cookie to verify the callback.
 */

import { requireUser } from "@/lib/auth-server";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { createHash, randomBytes } from 'crypto';

function buildState(userId: string, returnTo: string, nonce: string): string {
  const payload = JSON.stringify({ userId, returnTo, nonce });
  return Buffer.from(payload).toString('base64url');
}

/** Generates a PKCE code verifier and challenge for TikTok */
function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

const META_SCOPES = [
  'public_profile',
  'email',
  // Pages + Instagram scopes — require additional use cases in Meta app
  // Uncomment after adding Pages/Instagram use cases in Meta developer console:
  // 'pages_show_list',
  // 'pages_read_engagement',
  // 'pages_manage_posts',
  // 'instagram_basic',
  // 'instagram_content_publish',
].join(',');

const TIKTOK_SCOPES = ['user.info.basic', 'video.upload', 'video.list'].join(',');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') ?? '/tools/content-marketing';

  const baseUrl = env.BETTER_AUTH_URL ?? new URL(req.url).origin;
  const nonce = randomBytes(16).toString('hex');
  const state = buildState(authResult.user.id, returnTo, nonce);

  const cookieStore = await cookies();

  // Store state cookie for verification in callback
  cookieStore.set(`social_oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  let authUrl: string;

  switch (platform) {
    case 'meta': {
      if (!env.META_APP_ID) {
        return new Response('Meta app not configured', { status: 503 });
      }
      const url = new URL('https://www.facebook.com/dialog/oauth');
      url.searchParams.set('client_id', env.META_APP_ID);
      url.searchParams.set('redirect_uri', `${baseUrl}/api/social/callback/meta`);
      url.searchParams.set('scope', META_SCOPES);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      authUrl = url.toString();
      break;
    }

    case 'tiktok': {
      if (!env.TIKTOK_CLIENT_KEY) {
        return new Response('TikTok app not configured', { status: 503 });
      }
      const { verifier, challenge } = generatePkce();
      // Store code verifier for PKCE
      cookieStore.set(`social_pkce_verifier_tiktok`, verifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });
      const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
      url.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY);
      url.searchParams.set('redirect_uri', `${baseUrl}/api/social/callback/tiktok`);
      url.searchParams.set('scope', TIKTOK_SCOPES);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      authUrl = url.toString();
      break;
    }

    default:
      return new Response('Unknown platform', { status: 400 });
  }

  redirect(authUrl);
}
