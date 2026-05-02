import { requireUser } from '@/lib/auth-server';
import { cropPriceLookupInputSchema } from '@/features/crop-price/schema';
import { runCropPriceLookup } from '@/features/crop-price/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = cropPriceLookupInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runCropPriceLookup(result.data);
  return Response.json(data);
}
