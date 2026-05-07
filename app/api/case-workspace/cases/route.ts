import { requireUser } from '@/lib/auth-server';
import { createCase, searchCases } from '@/features/case-workspace/service';
import { createCaseInputSchema, searchCasesInputSchema } from '@/features/case-workspace/schema';

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = searchCasesInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const cases = await searchCases(parsed.data, { userId: auth.user.id });
  return Response.json({ cases });
}

export async function PUT(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createCaseInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const createdCase = await createCase(parsed.data, { userId: auth.user.id });
  return Response.json({ case: createdCase }, { status: 201 });
}
