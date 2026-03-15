/**
 * Social account management service.
 * Handles OAuth token storage, retrieval, and refresh for connected social accounts.
 */

import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { socialAccount } from '@/db/schema';
import type { SocialPlatform, SocialAccountRecord, ConnectAccountInput } from './types';

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getConnectedAccounts(userId: string): Promise<SocialAccountRecord[]> {
  const rows = await db
    .select()
    .from(socialAccount)
    .where(and(eq(socialAccount.userId, userId), eq(socialAccount.isActive, true)));

  return rows.map(mapAccountRow);
}

export async function getAccountsByPlatform(
  userId: string,
  platform: SocialPlatform,
): Promise<SocialAccountRecord[]> {
  const rows = await db
    .select()
    .from(socialAccount)
    .where(
      and(
        eq(socialAccount.userId, userId),
        eq(socialAccount.platform, platform),
        eq(socialAccount.isActive, true),
      ),
    );

  return rows.map(mapAccountRow);
}

/** Full record including token — server-only, never send to client */
export async function getAccountWithToken(
  accountId: string,
  userId: string,
): Promise<(typeof socialAccount.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(socialAccount)
    .where(and(eq(socialAccount.id, accountId), eq(socialAccount.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

/** Returns accounts with tokens for a platform — server-only */
export async function getAccountsWithTokenByPlatform(
  userId: string,
  platform: SocialPlatform,
): Promise<(typeof socialAccount.$inferSelect)[]> {
  return db
    .select()
    .from(socialAccount)
    .where(
      and(
        eq(socialAccount.userId, userId),
        eq(socialAccount.platform, platform),
        eq(socialAccount.isActive, true),
      ),
    );
}

export async function upsertAccount(input: ConnectAccountInput): Promise<SocialAccountRecord> {
  const {
    userId,
    platform,
    platformAccountId,
    accountName,
    accountType,
    accessToken,
    refreshToken,
    tokenExpiresAt,
  } = input;

  // Check if account already exists (same user + platform + platformAccountId)
  const existing = await db
    .select()
    .from(socialAccount)
    .where(
      and(
        eq(socialAccount.userId, userId),
        eq(socialAccount.platform, platform),
        eq(socialAccount.platformAccountId, platformAccountId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(socialAccount)
      .set({
        accountName,
        accountType: accountType ?? null,
        accessToken,
        refreshToken: refreshToken ?? null,
        tokenExpiresAt: tokenExpiresAt ?? null,
        isActive: true,
      })
      .where(eq(socialAccount.id, existing[0].id));

    const updated = await getAccountWithToken(existing[0].id, userId);
    return mapAccountRow(updated!);
  }

  const id = nanoid();
  await db.insert(socialAccount).values({
    id,
    userId,
    platform,
    platformAccountId,
    accountName,
    accountType: accountType ?? null,
    accessToken,
    refreshToken: refreshToken ?? null,
    tokenExpiresAt: tokenExpiresAt ?? null,
  });

  return mapAccountRow((await getAccountWithToken(id, userId))!);
}

export async function disconnectAccount(accountId: string, userId: string): Promise<void> {
  await db
    .update(socialAccount)
    .set({ isActive: false })
    .where(and(eq(socialAccount.id, accountId), eq(socialAccount.userId, userId)));
}

// ── Meta OAuth helpers ────────────────────────────────────────────────────────

/**
 * Exchange a short-lived Meta user access token for a long-lived one (60 days).
 */
export async function exchangeMetaLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL('https://graph.facebook.com/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta token exchange failed: ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Get the user's Facebook pages and their associated Instagram accounts.
 * Returns one entry per Facebook page + one per linked Instagram business account.
 */
export async function getMetaAccounts(userAccessToken: string): Promise<
  Array<{
    type: 'facebook' | 'instagram';
    platformAccountId: string;
    accountName: string;
    accountType: string;
    accessToken: string;
  }>
> {
  // Get Facebook Pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`,
  );
  if (!pagesRes.ok) throw new Error('Failed to fetch Facebook pages');

  const pagesData = (await pagesRes.json()) as {
    data: Array<{ id: string; name: string; access_token: string }>;
  };

  const accounts: Awaited<ReturnType<typeof getMetaAccounts>> = [];

  for (const page of pagesData.data ?? []) {
    // Add Facebook Page account
    accounts.push({
      type: 'facebook',
      platformAccountId: page.id,
      accountName: page.name,
      accountType: 'page',
      accessToken: page.access_token,
    });

    // Try to get linked Instagram Business Account
    const igRes = await fetch(
      `https://graph.facebook.com/${page.id}?fields=instagram_business_account{id,name,username}&access_token=${page.access_token}`,
    );
    if (!igRes.ok) continue;

    const igData = (await igRes.json()) as {
      instagram_business_account?: { id: string; name?: string; username?: string };
    };

    if (igData.instagram_business_account) {
      const ig = igData.instagram_business_account;
      accounts.push({
        type: 'instagram',
        platformAccountId: ig.id,
        accountName: ig.username ?? ig.name ?? `IG ${ig.id}`,
        accountType: 'business',
        accessToken: page.access_token, // Instagram uses the Page access token
      });
    }
  }

  return accounts;
}

// ── TikTok OAuth helpers ──────────────────────────────────────────────────────

export async function exchangeTikTokCode(
  code: string,
  codeVerifier: string,
  clientKey: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; openId: string }> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikTok token exchange failed: ${body}`);
  }

  const data = (await res.json()) as {
    data: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      open_id: string;
    };
  };

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    expiresIn: data.data.expires_in,
    openId: data.data.open_id,
  };
}

export async function getTikTokUserInfo(
  accessToken: string,
): Promise<{ openId: string; displayName: string }> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error('Failed to fetch TikTok user info');

  const data = (await res.json()) as {
    data: { user: { open_id: string; display_name: string } };
  };

  return {
    openId: data.data.user.open_id,
    displayName: data.data.user.display_name,
  };
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function mapAccountRow(row: typeof socialAccount.$inferSelect): SocialAccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform as SocialPlatform,
    platformAccountId: row.platformAccountId,
    accountName: row.accountName,
    accountType: row.accountType,
    tokenExpiresAt: row.tokenExpiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
