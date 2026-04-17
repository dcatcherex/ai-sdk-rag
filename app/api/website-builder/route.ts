import { requireUser } from "@/lib/auth-server";
import { listUserWebsites } from '@/features/website-builder/service';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  try {
    const websites = await listUserWebsites(authResult.user.id);
    return Response.json({ websites });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(message, { status: 500 });
  }
}
