import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { checkGuardrails } from '@/features/brand-guardrails/service';
import { checkGuardrailsSchema } from '@/features/brand-guardrails/schema';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = checkGuardrailsSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const checkResult = await checkGuardrails(
    result.data.brandId,
    result.data.content,
    session.user.id,
  );
  return NextResponse.json(checkResult);
}
