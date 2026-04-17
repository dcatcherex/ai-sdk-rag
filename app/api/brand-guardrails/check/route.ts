import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { checkGuardrails } from '@/features/brand-guardrails/service';
import { checkGuardrailsSchema } from '@/features/brand-guardrails/schema';

export async function POST(req: NextRequest) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = checkGuardrailsSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const checkResult = await checkGuardrails(
    result.data.brandId,
    result.data.content,
    authResult.user.id,
  );
  return NextResponse.json(checkResult);
}
