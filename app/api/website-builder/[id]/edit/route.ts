import { requireUser } from "@/lib/auth-server";
import { websiteEditAction } from '@/features/website-builder/service';
import { editWebsiteInputSchema } from '@/features/website-builder/schema';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json();
  const result = editWebsiteInputSchema.safeParse({ ...body, websiteId: id });
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const action = await websiteEditAction(result.data, {
      userId: authResult.user.id,
      source: 'sidebar',
    });
    return Response.json(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
