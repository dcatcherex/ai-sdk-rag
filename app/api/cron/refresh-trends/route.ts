import { env } from '@/lib/env';
import { refreshAllTrends } from '@/features/content-marketing/trend-service';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await refreshAllTrends();
  return Response.json({ ok: true, ...result });
}
