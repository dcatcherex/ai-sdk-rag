import { requireUser } from "@/lib/auth-server";
import { generateEmailSequence, createContentPiece } from '@/features/long-form/service';
import { generateEmailSequenceSchema } from '@/features/long-form/schema';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = generateEmailSequenceSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const generated = await generateEmailSequence(result.data);
  const piece = await createContentPiece(authResult.user.id, {
    contentType: 'email_sequence',
    title: generated.title,
    body: generated.body,
    excerpt: generated.excerpt,
    status: 'draft',
  });

  return Response.json(piece, { status: 201 });
}
