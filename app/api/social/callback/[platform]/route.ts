/**
 * OAuth callback handler for social platforms.
 * GET /api/social/callback/[platform]?code=...&state=...
 *
 * Exchanges the authorization code for access tokens,
 * stores the account in the DB, and redirects back to returnTo.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import {
  exchangeMetaLongLivedToken,
  getMetaAccounts,
  exchangeTikTokCode,
  getTikTokUserInfo,
  upsertAccount,
} from '@/features/content-marketing/social-account-service';

function parseState(state: string): { userId: string; returnTo: string; nonce: string } | null {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string;
      returnTo: string;
      nonce: string;
    };
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get(`social_oauth_state_${platform}`)?.value;

  // Clear state cookie
  cookieStore.delete(`social_oauth_state_${platform}`);

  if (errorParam) {
    redirect(`/tools/content-marketing?error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !stateParam || !storedState || stateParam !== storedState) {
    redirect('/tools/content-marketing?error=invalid_state');
  }

  const stateData = parseState(stateParam);
  if (!stateData) {
    redirect('/tools/content-marketing?error=invalid_state');
  }

  const { userId, returnTo } = stateData;
  const baseUrl = env.BETTER_AUTH_URL ?? new URL(req.url).origin;

  try {
    switch (platform) {
      case 'meta': {
        if (!env.META_APP_ID || !env.META_APP_SECRET) {
          redirect(`${returnTo}?error=meta_not_configured`);
        }

        // Exchange code for short-lived token
        const tokenRes = await fetch(
          `https://graph.facebook.com/oauth/access_token?` +
            new URLSearchParams({
              client_id: env.META_APP_ID,
              client_secret: env.META_APP_SECRET,
              code,
              redirect_uri: `${baseUrl}/api/social/callback/meta`,
            }),
        );
        if (!tokenRes.ok) redirect(`${returnTo}?error=meta_token_failed`);

        const tokenData = (await tokenRes.json()) as { access_token: string };

        // Exchange for long-lived token
        const { accessToken: longLivedToken, expiresIn } =
          await exchangeMetaLongLivedToken(
            tokenData.access_token,
            env.META_APP_ID,
            env.META_APP_SECRET,
          );

        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

        // Get Facebook pages + linked Instagram accounts
        const metaAccounts = await getMetaAccounts(longLivedToken);

        for (const acct of metaAccounts) {
          await upsertAccount({
            userId,
            platform: acct.type,
            platformAccountId: acct.platformAccountId,
            accountName: acct.accountName,
            accountType: acct.accountType,
            accessToken: acct.accessToken,
            tokenExpiresAt,
          });
        }

        break;
      }

      case 'tiktok': {
        if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
          redirect(`${returnTo}?error=tiktok_not_configured`);
        }

        const codeVerifier = cookieStore.get('social_pkce_verifier_tiktok')?.value;
        cookieStore.delete('social_pkce_verifier_tiktok');

        if (!codeVerifier) redirect(`${returnTo}?error=missing_verifier`);

        const { accessToken, refreshToken, expiresIn, openId } =
          await exchangeTikTokCode(
            code,
            codeVerifier,
            env.TIKTOK_CLIENT_KEY,
            env.TIKTOK_CLIENT_SECRET,
            `${baseUrl}/api/social/callback/tiktok`,
          );

        const userInfo = await getTikTokUserInfo(accessToken);

        await upsertAccount({
          userId,
          platform: 'tiktok',
          platformAccountId: openId,
          accountName: userInfo.displayName,
          accountType: 'creator',
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        });

        break;
      }

      default:
        redirect(`${returnTo}?error=unknown_platform`);
    }

    redirect(`${returnTo}?connected=${platform}`);
  } catch (err) {
    console.error(`[social/callback/${platform}]`, err);
    redirect(`${returnTo}?error=connection_failed`);
  }
}
