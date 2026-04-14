import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { connectedAccount } from '@/db/schema';
import { env } from '@/lib/env';

export const GOOGLE_WORKSPACE_PROVIDER = 'google';

export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive.file',
] as const;

export type GoogleAccountRecord = typeof connectedAccount.$inferSelect;

export function getGoogleWorkspaceAuthConfig() {
  return {
    clientId: env.GOOGLE_WORKSPACE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_WORKSPACE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
  };
}

export function isGoogleWorkspaceConfigured() {
  const { clientId, clientSecret } = getGoogleWorkspaceAuthConfig();
  return Boolean(clientId && clientSecret);
}

export function encodeOAuthState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeOAuthState<T extends Record<string, string>>(state: string): T | null {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export async function getActiveGoogleAccount(userId: string): Promise<GoogleAccountRecord | null> {
  const rows = await db
    .select()
    .from(connectedAccount)
    .where(
      and(
        eq(connectedAccount.userId, userId),
        eq(connectedAccount.provider, GOOGLE_WORKSPACE_PROVIDER),
        eq(connectedAccount.isActive, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertGoogleAccount(input: {
  userId: string;
  providerAccountId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes: string[];
  metadata?: Record<string, unknown>;
}) {
  const existing = await db
    .select()
    .from(connectedAccount)
    .where(
      and(
        eq(connectedAccount.userId, input.userId),
        eq(connectedAccount.provider, GOOGLE_WORKSPACE_PROVIDER),
        eq(connectedAccount.providerAccountId, input.providerAccountId),
      ),
    )
    .limit(1);

  const values = {
    email: input.email ?? null,
    displayName: input.displayName ?? null,
    avatarUrl: input.avatarUrl ?? null,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    scopes: input.scopes,
    metadata: input.metadata ?? {},
    isActive: true,
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await db
      .update(connectedAccount)
      .set(values)
      .where(eq(connectedAccount.id, existing[0].id));

    return (await getActiveGoogleAccount(input.userId))!;
  }

  const id = nanoid();
  await db.insert(connectedAccount).values({
    id,
    userId: input.userId,
    provider: GOOGLE_WORKSPACE_PROVIDER,
    providerAccountId: input.providerAccountId,
    ...values,
  });

  return (await getActiveGoogleAccount(input.userId))!;
}

export async function disconnectGoogleAccount(userId: string) {
  await db
    .update(connectedAccount)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(connectedAccount.userId, userId),
        eq(connectedAccount.provider, GOOGLE_WORKSPACE_PROVIDER),
      ),
    );
}

export async function ensureGoogleAccessToken(userId: string) {
  const account = await getActiveGoogleAccount(userId);
  if (!account) {
    throw new Error('Google Workspace account not connected');
  }

  const now = Date.now();
  const expiresAt = account.tokenExpiresAt?.getTime() ?? 0;

  if (expiresAt > now + 60_000 || !account.refreshToken) {
    return { account, accessToken: account.accessToken };
  }

  const refreshed = await refreshGoogleAccessToken(account.id);
  return { account: refreshed, accessToken: refreshed.accessToken };
}

export async function refreshGoogleAccessToken(accountId: string) {
  const rows = await db
    .select()
    .from(connectedAccount)
    .where(eq(connectedAccount.id, accountId))
    .limit(1);

  const account = rows[0];
  if (!account) throw new Error('Connected account not found');
  if (!account.refreshToken) throw new Error('Google account has no refresh token');

  const { clientId, clientSecret } = getGoogleWorkspaceAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Google Workspace OAuth not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  await db
    .update(connectedAccount)
    .set({
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope ? data.scope.split(' ') : account.scopes,
      updatedAt: new Date(),
    })
    .where(eq(connectedAccount.id, accountId));

  const refreshedRows = await db
    .select()
    .from(connectedAccount)
    .where(eq(connectedAccount.id, accountId))
    .limit(1);

  return refreshedRows[0]!;
}

export function ensureGoogleScopes(account: Pick<GoogleAccountRecord, 'scopes'>, requiredScopes: string[]) {
  const missing = requiredScopes.filter((scope) => !account.scopes.includes(scope));
  if (missing.length > 0) {
    throw new Error(`Google account is missing required scopes: ${missing.join(', ')}`);
  }
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getGoogleWorkspaceAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error('Google Workspace OAuth not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google code exchange failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function getGoogleUserProfile(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google user profile fetch failed: ${await res.text()}`);
  }

  return (await res.json()) as {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}
