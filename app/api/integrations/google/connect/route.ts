import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  GOOGLE_WORKSPACE_SCOPES,
  encodeOAuthState,
  getGoogleWorkspaceAuthConfig,
  isGoogleWorkspaceConfigured,
} from '@/lib/google/oauth';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  if (!isGoogleWorkspaceConfigured()) {
    return new Response('Google Workspace OAuth not configured', { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') ?? '/tools/google-sheets';
  const state = encodeOAuthState({
    userId: session.user.id,
    returnTo,
  });

  const cookieStore = await cookies();
  cookieStore.set('google_workspace_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const baseUrl = env.BETTER_AUTH_URL ?? new URL(req.url).origin;
  const { clientId } = getGoogleWorkspaceAuthConfig();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId!);
  url.searchParams.set('redirect_uri', `${baseUrl}/api/integrations/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('scope', GOOGLE_WORKSPACE_SCOPES.join(' '));
  url.searchParams.set('state', state);

  redirect(url.toString());
}
