/**
 * Manual recovery endpoint for publishing due posts in bulk.
 * Production scheduling now uses Trigger.dev per post.
 *
 * Protected by CRON_SECRET when configured.
 */

import { env } from '@/lib/env';
import { publishDuePosts } from '@/features/content-marketing/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
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
