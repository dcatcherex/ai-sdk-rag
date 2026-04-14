import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { isValidKieCallbackToken } from '@/lib/kie-callback';
import { resolveKieJobsStatusPayload } from '@/app/api/generate/_shared/kieStatus';

type CallbackRecord = {
  id: string;
  status: string;
  createdAt: Date;
  outputJson: Record<string, unknown> | null;
};

function getTaskIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const taskId = (data as { taskId?: unknown }).taskId;
  return typeof taskId === 'string' && taskId.trim().length > 0 ? taskId : null;
}

function isSupportedToolSlug(value: string): value is 'image' | 'video' | 'speech' {
  return value === 'image' || value === 'video' || value === 'speech';
}

async function findRunByTaskId(taskId: string): Promise<CallbackRecord | null> {
  const rows = await db
    .select({
      id: toolRun.id,
      status: toolRun.status,
      createdAt: toolRun.createdAt,
      outputJson: toolRun.outputJson,
    })
    .from(toolRun)
    .where(sql`${toolRun.inputJson}->>'kieTaskId' = ${taskId}`)
    .limit(1);

  return (rows[0] as CallbackRecord | undefined) ?? null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!isValidKieCallbackToken(url.searchParams.get('token'))) {
    return Response.json({ error: 'Invalid callback token' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const taskId = getTaskIdFromPayload(payload);

  if (!taskId) {
    return Response.json({ error: 'Missing taskId' }, { status: 400 });
  }

  const [toolSlugRow] = await db
    .select({ toolSlug: toolRun.toolSlug })
    .from(toolRun)
    .where(sql`${toolRun.inputJson}->>'kieTaskId' = ${taskId}`)
    .limit(1);

  if (!toolSlugRow || !isSupportedToolSlug(toolSlugRow.toolSlug)) {
    return Response.json({ ok: true, ignored: true, reason: 'No matching supported run' });
  }

  const record = await findRunByTaskId(taskId);
  if (!record) {
    return Response.json({ ok: true, ignored: true, reason: 'Run not found' });
  }

  if (record.status === 'success') {
    return Response.json({ ok: true, ignored: true, reason: 'Already completed' });
  }

  const result = resolveKieJobsStatusPayload(payload as { code?: number; msg?: string; data?: Record<string, any> | null });

  if (result.status === 'processing') {
    return Response.json({ ok: true, status: 'processing' });
  }

  const outputJson = (record.outputJson ?? {}) as Record<string, unknown>;

  if (result.status === 'failed') {
    await db.update(toolRun)
      .set({
        status: 'error',
        errorMessage: result.error,
        outputJson: {
          ...outputJson,
          callbackReceived: true,
        },
      })
      .where(eq(toolRun.id, record.id));

    return Response.json({ ok: true, status: 'failed' });
  }

  const latency = Math.round(Date.now() - new Date(record.createdAt).getTime());

  await db.update(toolRun)
    .set({
      status: 'success',
      completedAt: new Date(),
      outputJson: {
        ...outputJson,
        output: result.outputUrl,
        latency,
        callbackReceived: true,
      },
    })
    .where(eq(toolRun.id, record.id));

  return Response.json({ ok: true, status: 'success' });
}
