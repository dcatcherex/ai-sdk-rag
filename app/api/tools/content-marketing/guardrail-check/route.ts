import { requireUser } from "@/lib/auth-server";
import { z } from 'zod';
import { checkGuardrails } from '@/features/brand-guardrails/service';

const schema = z.object({
  brandId: z.string().min(1),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const checkResult = await checkGuardrails(
    result.data.brandId,
    result.data.content,
    authResult.user.id,
  );
  return Response.json(checkResult);
}
