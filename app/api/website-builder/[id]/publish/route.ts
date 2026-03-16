import { auth } from '@/lib/auth';
import { runPublishWebsite } from '@/features/website-builder/service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const result = await runPublishWebsite(id, { userId: session.user.id, source: 'sidebar' });
    return Response.json({ liveUrl: result.liveUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
