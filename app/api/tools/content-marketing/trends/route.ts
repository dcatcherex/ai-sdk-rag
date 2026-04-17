import { requireUser } from "@/lib/auth-server";
import { headers } from 'next/headers';
import { deductCredits, getUserBalance } from '@/lib/credits';
import { getTrends } from '@/features/content-marketing/trend-service';
import type { TrendPlatform } from '@/features/content-marketing/types';

const ON_DEMAND_CREDIT_COST = 5;

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform') as TrendPlatform | null;
  const industry = searchParams.get('industry') ?? 'all';

  const result = await getTrends({ platform: platform ?? undefined, industry });
  return Response.json(result);
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = (await req.json()) as { platform?: string; industry?: string };
  const platform = body.platform as TrendPlatform | undefined;
  const industry = body.industry ?? 'all';

  // Check credits for on-demand refresh
  const balance = await getUserBalance(authResult.user.id);
  if (balance < ON_DEMAND_CREDIT_COST) {
    return new Response(
      JSON.stringify({ error: 'Insufficient credits', required: ON_DEMAND_CREDIT_COST, balance }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  }

  await deductCredits({ userId: authResult.user.id, amount: ON_DEMAND_CREDIT_COST, description: 'Trend refresh' });

  const result = await getTrends({ platform, industry, forceRefresh: true });
  return Response.json({ ...result, creditsUsed: ON_DEMAND_CREDIT_COST });
}
