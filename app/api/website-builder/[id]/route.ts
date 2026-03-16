import { auth } from '@/lib/auth';
import { runGetWebsiteStatus, deleteWebsite } from '@/features/website-builder/service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const record = await runGetWebsiteStatus(id, { userId: session.user.id });
    return Response.json({ website: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    await deleteWebsite(id, { userId: session.user.id });
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
