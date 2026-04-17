import { requireUser } from "@/lib/auth-server";
import { createSpreadsheetInputSchema } from '@/features/google-sheets/schema';
import { createSpreadsheetAction } from '@/features/google-sheets/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createSpreadsheetInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await createSpreadsheetAction(result.data, authResult.user.id);
  return Response.json(data);
}
