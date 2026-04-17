import { requireUser } from "@/lib/auth-server";
import { generateNewsletter, createContentPiece } from '@/features/long-form/service';
import { generateNewsletterSchema } from '@/features/long-form/schema';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json() as unknown;
  const result = generateNewsletterSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const generated = await generateNewsletter(result.data);
  const piece = await createContentPiece(authResult.user.id, {
    contentType: 'newsletter',
    title: generated.title,
    body: generated.body,
    excerpt: generated.excerpt,
    status: 'draft',
  });

  return Response.json(piece, { status: 201 });
}
