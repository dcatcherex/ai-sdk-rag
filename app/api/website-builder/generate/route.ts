import { requireUser } from "@/lib/auth-server";
import { websiteGenerateAction } from '@/features/website-builder/service';
import { generateWebsiteInputSchema } from '@/features/website-builder/schema';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = generateWebsiteInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const action = await websiteGenerateAction(result.data, {
      userId: authResult.user.id,
      source: 'sidebar',
    });
    return Response.json(action);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.includes('Insufficient credits') ? 402 : 500;
    return new Response(message, { status });
  }
}
