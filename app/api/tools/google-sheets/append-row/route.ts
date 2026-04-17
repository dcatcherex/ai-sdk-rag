import { requireUser } from "@/lib/auth-server";
import { appendSheetRowInputSchema } from '@/features/google-sheets/schema';
import { appendSheetRowAction } from '@/features/google-sheets/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = appendSheetRowInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await appendSheetRowAction(result.data, authResult.user.id);
  return Response.json(data);
}
