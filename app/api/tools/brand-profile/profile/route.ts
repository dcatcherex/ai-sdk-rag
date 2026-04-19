import { auth } from '@/lib/auth';
import { getBrandProfileAction, saveBrandProfileAction } from '@/features/brand-profile/service';
import { saveBrandProfileInputSchema } from '@/features/brand-profile/schema';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const result = await getBrandProfileAction({}, { userId: session.user.id });
  return Response.json(result.data);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const parsed = saveBrandProfileInputSchema.safeParse(body);
  if (!parsed.success) return new Response('Bad Request', { status: 400 });

  const result = await saveBrandProfileAction(parsed.data, { userId: session.user.id });
  return Response.json(result.data);
}
