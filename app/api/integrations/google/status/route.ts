import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getActiveGoogleAccount, isGoogleWorkspaceConfigured } from '@/lib/google/oauth';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const account = await getActiveGoogleAccount(session.user.id);

  return Response.json({
    configured: isGoogleWorkspaceConfigured(),
    connected: Boolean(account),
    account: account
      ? {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          scopes: account.scopes,
          tokenExpiresAt: account.tokenExpiresAt,
          updatedAt: account.updatedAt,
        }
      : null,
  });
}
