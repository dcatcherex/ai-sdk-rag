import { auth } from '@/lib/auth';
import { websiteEditAction } from '@/features/website-builder/service';
import { editWebsiteInputSchema } from '@/features/website-builder/schema';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = editWebsiteInputSchema.safeParse({ ...body, websiteId: id });
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const action = await websiteEditAction(result.data, {
      userId: session.user.id,
      source: 'sidebar',
    });
    return Response.json(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
