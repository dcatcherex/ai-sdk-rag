import { requireUser } from "@/lib/auth-server";
import { createGoogleSlidesDeckInputSchema } from '@/features/google-slides/schema';
import { createGoogleSlidesDeckAction } from '@/features/google-slides/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createGoogleSlidesDeckInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createGoogleSlidesDeckAction(result.data, authResult.user.id);
  return Response.json(data);
}
