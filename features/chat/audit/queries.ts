import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { chatRun } from "@/db/schema";
import { db } from "@/lib/db";
import type { ChatRunDetail, ChatRunsOverview } from "./types";

type ListChatRunsOptions = {
  limit?: number;
};

export async function getChatRunsOverview(
  userId: string,
  options: ListChatRunsOptions = {},
): Promise<ChatRunsOverview> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const [runs, statusRows, routeRows, modelRows, routingRows, responseIntentRows] = await Promise.all([
    db
      .select({
        id: chatRun.id,
        threadId: chatRun.threadId,
        agentId: chatRun.agentId,
        brandId: chatRun.brandId,
        status: chatRun.status,
        routeKind: chatRun.routeKind,
        requestedModelId: chatRun.requestedModelId,
        resolvedModelId: chatRun.resolvedModelId,
        routingMode: chatRun.routingMode,
        routingReason: chatRun.routingReason,
        useWebSearch: chatRun.useWebSearch,
        usedTools: chatRun.usedTools,
        toolCallCount: chatRun.toolCallCount,
        creditCost: chatRun.creditCost,
        totalTokens: chatRun.totalTokens,
        responseIntent: sql<string | null>`${chatRun.outputJson}->>'responseIntent'`,
        responseFormats: sql<string[]>`coalesce(${chatRun.outputJson}->'responseFormats', '[]'::jsonb)`,
        templateKey: sql<string | null>`${chatRun.outputJson}->>'templateKey'`,
        quickReplyCount: sql<number>`coalesce((${chatRun.outputJson}->>'quickReplyCount')::int, 0)`,
        escalationCreated: sql<boolean>`coalesce((${chatRun.outputJson}->>'escalationCreated')::boolean, false)`,
        renderFallbackUsed: sql<boolean>`coalesce((${chatRun.outputJson}->>'renderFallbackUsed')::boolean, false)`,
        errorMessage: chatRun.errorMessage,
        createdAt: chatRun.createdAt,
        completedAt: chatRun.completedAt,
      })
      .from(chatRun)
      .where(eq(chatRun.userId, userId))
      .orderBy(desc(chatRun.createdAt))
      .limit(limit),
    db
      .select({
        key: chatRun.status,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .where(eq(chatRun.userId, userId))
      .groupBy(chatRun.status),
    db
      .select({
        key: chatRun.routeKind,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .where(eq(chatRun.userId, userId))
      .groupBy(chatRun.routeKind),
    db
      .select({
        key: chatRun.resolvedModelId,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .where(and(eq(chatRun.userId, userId), sql`${chatRun.resolvedModelId} is not null`))
      .groupBy(chatRun.resolvedModelId),
    db
      .select({
        key: chatRun.routingMode,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .where(and(eq(chatRun.userId, userId), sql`${chatRun.routingMode} is not null`))
      .groupBy(chatRun.routingMode),
    db
      .select({
        key: sql<string | null>`${chatRun.outputJson}->>'responseIntent'`,
        count: sql<number>`count(*)::int`,
      })
      .from(chatRun)
      .where(and(eq(chatRun.userId, userId), sql`${chatRun.outputJson}->>'responseIntent' is not null`))
      .groupBy(sql`${chatRun.outputJson}->>'responseIntent'`),
  ]);

  const statusCounts = {
    success: 0,
    error: 0,
    pending: 0,
  };

  for (const row of statusRows) {
    if (row.key === "success" || row.key === "error" || row.key === "pending") {
      statusCounts[row.key] = row.count;
    }
  }

  return {
    summary: {
      totalRuns: statusCounts.success + statusCounts.error + statusCounts.pending,
      successCount: statusCounts.success,
      errorCount: statusCounts.error,
      pendingCount: statusCounts.pending,
      byRouteKind: routeRows.map((row) => ({ key: row.key, count: row.count })),
      byResolvedModel: modelRows.flatMap((row) => (row.key ? [{ key: row.key, count: row.count }] : [])),
      byRoutingMode: routingRows.flatMap((row) => (row.key ? [{ key: row.key, count: row.count }] : [])),
      byResponseIntent: responseIntentRows.flatMap((row) => (row.key ? [{ key: row.key, count: row.count }] : [])),
    },
    runs: runs.map((run) => ({
      ...run,
      status: run.status === "success" || run.status === "error" ? run.status : "pending",
      routeKind: run.routeKind === "image" ? "image" : "text",
      routingMode: run.routingMode === "manual" || run.routingMode === "auto" ? run.routingMode : null,
      responseFormats: normalizeStringArray(run.responseFormats),
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    })),
  };
}

export async function getChatRunById(runId: string, userId: string): Promise<ChatRunDetail | null> {
  const rows = await db
    .select({
      id: chatRun.id,
      threadId: chatRun.threadId,
      agentId: chatRun.agentId,
      brandId: chatRun.brandId,
      status: chatRun.status,
      routeKind: chatRun.routeKind,
      requestedModelId: chatRun.requestedModelId,
      resolvedModelId: chatRun.resolvedModelId,
      routingMode: chatRun.routingMode,
      routingReason: chatRun.routingReason,
      useWebSearch: chatRun.useWebSearch,
      usedTools: chatRun.usedTools,
      toolCallCount: chatRun.toolCallCount,
      creditCost: chatRun.creditCost,
      promptTokens: chatRun.promptTokens,
      completionTokens: chatRun.completionTokens,
      totalTokens: chatRun.totalTokens,
      responseIntent: sql<string | null>`${chatRun.outputJson}->>'responseIntent'`,
      responseFormats: sql<string[]>`coalesce(${chatRun.outputJson}->'responseFormats', '[]'::jsonb)`,
      templateKey: sql<string | null>`${chatRun.outputJson}->>'templateKey'`,
      quickReplyCount: sql<number>`coalesce((${chatRun.outputJson}->>'quickReplyCount')::int, 0)`,
      escalationCreated: sql<boolean>`coalesce((${chatRun.outputJson}->>'escalationCreated')::boolean, false)`,
      renderFallbackUsed: sql<boolean>`coalesce((${chatRun.outputJson}->>'renderFallbackUsed')::boolean, false)`,
      inputJson: chatRun.inputJson,
      outputJson: chatRun.outputJson,
      errorMessage: chatRun.errorMessage,
      startedAt: chatRun.startedAt,
      createdAt: chatRun.createdAt,
      completedAt: chatRun.completedAt,
    })
    .from(chatRun)
    .where(and(eq(chatRun.id, runId), eq(chatRun.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row,
    status: row.status === "success" || row.status === "error" ? row.status : "pending",
    routeKind: row.routeKind === "image" ? "image" : "text",
    routingMode: row.routingMode === "manual" || row.routingMode === "auto" ? row.routingMode : null,
    responseFormats: normalizeStringArray(row.responseFormats),
    inputJson: isRecord(row.inputJson) ? row.inputJson : {},
    outputJson: isRecord(row.outputJson) ? row.outputJson : null,
    startedAt: row.startedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => (typeof entry === 'string' && entry.trim() ? [entry] : []));
}
