import { sql } from 'drizzle-orm';
import { chatRun, toolRun, workspaceAiRun } from '@/db/schema';
import { db } from '@/lib/db';
import { buildThresholdAlerts, createMetric, withProviderStatus } from '@/features/admin/usage/normalizers';
import type { UsageProviderSnapshot } from '@/features/admin/usage/types';

export async function getInternalAiUsageSnapshot(windowDays: number): Promise<UsageProviderSnapshot> {
  const collectedAt = new Date().toISOString();
  const endExclusive = tomorrowUtc();
  const startInclusive = daysBeforeUtc(endExclusive, windowDays - 1);

  const [chatRow, workspaceRow, toolRow] = await Promise.all([
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${chatRun.status} = 'error')::int, 0) as error_count,
        coalesce(sum(${chatRun.totalTokens}), 0)::int as token_total,
        coalesce(sum(${chatRun.creditCost}), 0)::int as credit_total
      from ${chatRun}
      where ${chatRun.createdAt} >= ${startInclusive}
        and ${chatRun.createdAt} < ${endExclusive}
    `),
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${workspaceAiRun.status} = 'error')::int, 0) as error_count
      from ${workspaceAiRun}
      where ${workspaceAiRun.createdAt} >= ${startInclusive}
        and ${workspaceAiRun.createdAt} < ${endExclusive}
    `),
    db.execute(sql`
      select
        coalesce(count(*)::int, 0) as run_count,
        coalesce(count(*) filter (where ${toolRun.status} = 'error')::int, 0) as error_count
      from ${toolRun}
      where ${toolRun.createdAt} >= ${startInclusive}
        and ${toolRun.createdAt} < ${endExclusive}
    `),
  ]);

  const chat = chatRow.rows[0] ?? {};
  const workspace = workspaceRow.rows[0] ?? {};
  const tool = toolRow.rows[0] ?? {};

  const totalRuns = Number(chat.run_count ?? 0) + Number(workspace.run_count ?? 0) + Number(tool.run_count ?? 0);
  const totalErrors = Number(chat.error_count ?? 0) + Number(workspace.error_count ?? 0) + Number(tool.error_count ?? 0);
  const errorRate = totalRuns > 0 ? Math.round((totalErrors / totalRuns) * 1000) / 10 : 0;

  const metrics = [
    createMetric({
      key: 'total-runs',
      label: `AI runs (${windowDays}d)`,
      value: totalRuns,
      unit: 'count',
      status: 'live',
      updatedAt: collectedAt,
      note: 'Derived from chat_run, workspace_ai_run, and tool_run ledgers.',
    }),
    createMetric({
      key: 'errors',
      label: `AI errors (${windowDays}d)`,
      value: totalErrors,
      unit: 'count',
      status: 'live',
      updatedAt: collectedAt,
      note: 'Derived from internal AI run status fields.',
    }),
    createMetric({
      key: 'error-rate',
      label: `AI error rate (${windowDays}d)`,
      value: errorRate,
      unit: 'percent',
      status: 'live',
      updatedAt: collectedAt,
      note: 'Calculated across all internal AI ledgers.',
    }),
    createMetric({
      key: 'tokens',
      label: `Chat tokens (${windowDays}d)`,
      value: Number(chat.token_total ?? 0),
      unit: 'tokens',
      status: 'live',
      updatedAt: collectedAt,
      note: 'Currently available from chat_run totals.',
    }),
    createMetric({
      key: 'credits',
      label: `Credits charged (${windowDays}d)`,
      value: Number(chat.credit_total ?? 0),
      unit: 'credits',
      status: 'live',
      updatedAt: collectedAt,
      note: 'Currently available from chat_run credit_cost totals.',
    }),
  ];

  return withProviderStatus({
    provider: 'internal-ai',
    label: 'Internal AI',
    collectedAt,
    metrics,
    alerts: buildThresholdAlerts('internal-ai', 'Internal AI', metrics),
    rawAvailable: true,
  });
}

function tomorrowUtc() {
  const today = new Date();
  const utc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc;
}

function daysBeforeUtc(dateExclusive: Date, dayCount: number) {
  const copy = new Date(dateExclusive);
  copy.setUTCDate(copy.getUTCDate() - dayCount);
  return copy;
}
