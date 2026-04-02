import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { repurposeContent } from '@/features/repurposing/service';
import { repurposeInputSchema } from '@/features/repurposing/schema';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as unknown;
  const result = repurposeInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const pieces = await repurposeContent(session.user.id, result.data);
  return Response.json(pieces, { status: 201 });
}
