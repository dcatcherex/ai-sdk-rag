import { requireUser } from "@/lib/auth-server";
import { createGoogleDocFromTemplateInputSchema } from '@/features/google-docs/schema';
import { createGoogleDocFromTemplateAction } from '@/features/google-docs/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createGoogleDocFromTemplateInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createGoogleDocFromTemplateAction(result.data, authResult.user.id);
  return Response.json(data);
}
