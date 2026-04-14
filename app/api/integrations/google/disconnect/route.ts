import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { disconnectGoogleAccount } from '@/lib/google/oauth';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await disconnectGoogleAccount(session.user.id);
  return Response.json({ ok: true });
}
