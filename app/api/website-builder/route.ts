import { auth } from '@/lib/auth';
import { listUserWebsites } from '@/features/website-builder/service';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  try {
    const websites = await listUserWebsites(session.user.id);
    return Response.json({ websites });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(message, { status: 500 });
  }
}
