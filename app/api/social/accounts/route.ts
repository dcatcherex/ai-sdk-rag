import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import {
  getConnectedAccounts,
  disconnectAccount,
} from '@/features/content-marketing/social-account-service';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const accounts = await getConnectedAccounts(session.user.id);
  return Response.json({ accounts });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('id');
  if (!accountId) return new Response('Missing id', { status: 400 });

  await disconnectAccount(accountId, session.user.id);
  return new Response(null, { status: 204 });
}
