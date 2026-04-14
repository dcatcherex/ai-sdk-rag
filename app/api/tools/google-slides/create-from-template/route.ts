import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { createGoogleSlidesFromTemplateInputSchema } from '@/features/google-slides/schema';
import { createGoogleSlidesFromTemplateAction } from '@/features/google-slides/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = createGoogleSlidesFromTemplateInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createGoogleSlidesFromTemplateAction(result.data, session.user.id);
  return Response.json(data);
}
