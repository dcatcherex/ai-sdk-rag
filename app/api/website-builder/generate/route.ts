import { auth } from '@/lib/auth';
import { websiteGenerateAction } from '@/features/website-builder/service';
import { generateWebsiteInputSchema } from '@/features/website-builder/schema';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = generateWebsiteInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const action = await websiteGenerateAction(result.data, {
      userId: session.user.id,
      source: 'sidebar',
    });
    return Response.json(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : 500;
    return new Response(message, { status });
  }
}
