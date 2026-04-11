import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { workspaceAiRun } from '@/db/schema';
import type { WorkspaceAiRunsOverview } from './types';

type ListWorkspaceAiRunsOptions = {
  limit?: number;
};

export async function getWorkspaceAiRunsOverview(
  userId: string,
  options: ListWorkspaceAiRunsOptions = {},
): Promise<WorkspaceAiRunsOverview> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const [runs, statusRows, kindRows, routeRows] = await Promise.all([
    db
      .select({
        id: workspaceAiRun.id,
        kind: workspaceAiRun.kind,
        route: workspaceAiRun.route,
        status: workspaceAiRun.status,
        entityType: workspaceAiRun.entityType,
        entityId: workspaceAiRun.entityId,
        modelId: workspaceAiRun.modelId,
        errorMessage: workspaceAiRun.errorMessage,
        createdAt: workspaceAiRun.createdAt,
        completedAt: workspaceAiRun.completedAt,
      })
      .from(workspaceAiRun)
      .where(eq(workspaceAiRun.userId, userId))
      .orderBy(desc(workspaceAiRun.createdAt))
      .limit(limit),
    db
      .select({
        key: workspaceAiRun.status,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .where(eq(workspaceAiRun.userId, userId))
      .groupBy(workspaceAiRun.status),
    db
      .select({
        key: workspaceAiRun.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .where(eq(workspaceAiRun.userId, userId))
      .groupBy(workspaceAiRun.kind),
    db
      .select({
        key: workspaceAiRun.route,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceAiRun)
      .where(eq(workspaceAiRun.userId, userId))
      .groupBy(workspaceAiRun.route),
  ]);

  const statusCounts = {
    success: 0,
    error: 0,
    pending: 0,
  };

  for (const row of statusRows) {
    if (row.key === 'success' || row.key === 'error' || row.key === 'pending') {
      statusCounts[row.key] = row.count;
    }
  }

  return {
    summary: {
      totalRuns: statusCounts.success + statusCounts.error + statusCounts.pending,
      successCount: statusCounts.success,
      errorCount: statusCounts.error,
      pendingCount: statusCounts.pending,
      byKind: kindRows.map((row) => ({ key: row.key, count: row.count })),
      byRoute: routeRows.map((row) => ({ key: row.key, count: row.count })),
    },
    runs: runs.map((run) => ({
      ...run,
      route: run.route === 'image' ? 'image' : 'text',
      status:
        run.status === 'success' || run.status === 'error' || run.status === 'pending'
          ? run.status
          : 'pending',
      entityType: run.entityType === 'skill' ? 'skill' : 'agent',
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    })),
  };
}
