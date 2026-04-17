import { requireUser } from "@/lib/auth-server";
import { createSheetTabInputSchema } from '@/features/google-sheets/schema';
import { createSheetTabAction } from '@/features/google-sheets/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createSheetTabInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createSheetTabAction(result.data, authResult.user.id);
  return Response.json(data);
}
