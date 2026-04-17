import { requireUser } from "@/lib/auth-server";
import { readSheetRangeInputSchema } from '@/features/google-sheets/schema';
import { readSheetRangeAction } from '@/features/google-sheets/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = readSheetRangeInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await readSheetRangeAction(result.data, authResult.user.id);
  return Response.json(data);
}
