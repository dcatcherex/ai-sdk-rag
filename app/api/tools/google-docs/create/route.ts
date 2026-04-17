import { requireUser } from "@/lib/auth-server";
import { createGoogleDocInputSchema } from '@/features/google-docs/schema';
import { createGoogleDocAction } from '@/features/google-docs/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createGoogleDocInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createGoogleDocAction(result.data, authResult.user.id);
  return Response.json(data);
}
