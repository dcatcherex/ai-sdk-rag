import { requireUser } from "@/lib/auth-server";
import { runGetWebsiteStatus, deleteWebsite } from '@/features/website-builder/service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  try {
    const record = await runGetWebsiteStatus(id, { userId: authResult.user.id });
    return Response.json({ website: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;

  try {
    await deleteWebsite(id, { userId: authResult.user.id });
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('not found') ? 404 : 500;
    return new Response(message, { status });
  }
}
