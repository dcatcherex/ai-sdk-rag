import { requireUser } from "@/lib/auth-server";
import { getActiveGoogleAccount, isGoogleWorkspaceConfigured } from '@/lib/google/oauth';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const account = await getActiveGoogleAccount(authResult.user.id);

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
