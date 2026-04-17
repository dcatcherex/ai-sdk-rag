import { requireUser } from "@/lib/auth-server";
import { runPublishWebsite } from '@/features/website-builder/service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  try {
    const result = await runPublishWebsite(id, { userId: authResult.user.id, source: 'sidebar' });
    return Response.json({ liveUrl: result.liveUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
