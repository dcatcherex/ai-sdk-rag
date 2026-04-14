import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import {
  decodeOAuthState,
  exchangeGoogleCode,
  getGoogleUserProfile,
  isGoogleWorkspaceConfigured,
  upsertGoogleAccount,
} from '@/lib/google/oauth';

type OAuthState = {
  userId: string;
  returnTo: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_workspace_oauth_state')?.value;
  cookieStore.delete('google_workspace_oauth_state');

  const defaultReturnTo = '/tools/google-sheets';
  const fallbackRedirect = (reason: string) =>
    redirect(`${defaultReturnTo}?error=${encodeURIComponent(reason)}`);

  if (errorParam) fallbackRedirect(errorParam);
  if (!isGoogleWorkspaceConfigured()) fallbackRedirect('google_not_configured');
  if (!code || !stateParam || !storedState || stateParam !== storedState) {
    fallbackRedirect('invalid_state');
  }

  const safeCode = code!;
  const safeStateParam = stateParam!;
  const parsedState = decodeOAuthState<OAuthState>(safeStateParam);
  if (!parsedState?.userId || !parsedState.returnTo) {
    fallbackRedirect('invalid_state');
  }
  const state = parsedState!;

  const baseUrl = env.BETTER_AUTH_URL ?? new URL(req.url).origin;

  try {
    const token = await exchangeGoogleCode({
      code: safeCode,
      redirectUri: `${baseUrl}/api/integrations/google/callback`,
    });

    const profile = await getGoogleUserProfile(token.access_token);

    await upsertGoogleAccount({
      userId: state.userId,
      providerAccountId: profile.id,
      email: profile.email ?? null,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope.split(' '),
      metadata: {
        tokenType: token.token_type,
      },
    });

    const separator = state.returnTo.includes('?') ? '&' : '?';
    redirect(`${state.returnTo}${separator}connected=google`);
  } catch (error) {
    console.error('[integrations/google/callback]', error);
    const separator = state.returnTo.includes('?') ? '&' : '?';
    redirect(`${state.returnTo}${separator}error=connection_failed`);
  }
}
