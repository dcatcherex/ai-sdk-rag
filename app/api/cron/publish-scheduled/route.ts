/**
 * Vercel Cron job — publishes all scheduled posts that are due.
 * Runs every minute. Protected by CRON_SECRET (set automatically by Vercel).
 *
 * Schedule is configured in vercel.json:
 *   { "path": "/api/cron/publish-scheduled", "schedule": "* * * * *" }
 */

import { env } from '@/lib/env';
import { publishDuePosts } from '@/features/content-marketing/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify request is from Vercel Cron (or a local call with the secret)
  const authHeader = req.headers.get('authorization');
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const start = Date.now();

  try {
    const { processed, results } = await publishDuePosts();
    const elapsed = Date.now() - start;

    console.log(`[cron/publish-scheduled] processed=${processed} elapsed=${elapsed}ms`);

    return Response.json({
      ok: true,
      processed,
      elapsed,
      results: results.map((r) => ({
        postId: r.postId,
        outcomes: r.platformResults.map((p) => ({
          platform: p.platform,
          success: p.success,
          ...(p.error ? { error: p.error } : {}),
          ...(p.platformPostId ? { platformPostId: p.platformPostId } : {}),
        })),
      })),
    });
  } catch (err) {
    console.error('[cron/publish-scheduled] error', err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
