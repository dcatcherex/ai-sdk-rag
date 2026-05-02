import { requireUser } from '@/lib/auth-server';
import { marketSummaryInputSchema } from '@/features/crop-price/schema';
import { runMarketSummary } from '@/features/crop-price/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = marketSummaryInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await runMarketSummary(result.data);
  return Response.json(data);
}
