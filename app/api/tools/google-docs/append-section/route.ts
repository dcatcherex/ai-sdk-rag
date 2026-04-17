import { requireUser } from "@/lib/auth-server";
import { appendGoogleDocSectionInputSchema } from '@/features/google-docs/schema';
import { appendGoogleDocSectionAction } from '@/features/google-docs/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = appendGoogleDocSectionInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await appendGoogleDocSectionAction(result.data, authResult.user.id);
  return Response.json(data);
}
