import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkGuardrails } from '@/features/brand-guardrails/service';

const schema = z.object({
  brandId: z.string().min(1),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const checkResult = await checkGuardrails(
    result.data.brandId,
    result.data.content,
    session.user.id,
  );
  return Response.json(checkResult);
}
