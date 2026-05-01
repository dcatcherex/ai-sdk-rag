import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { toolArtifact, toolRun } from "@/db/schema";
import { db } from "@/lib/db";
import type { UserToolSource } from "../types";

export async function recordUserToolRunStart(params: {
  toolSlug: string;
  userId: string;
  threadId?: string | null;
  source: UserToolSource;
  inputJson: Record<string, unknown>;
}) {
  const id = nanoid();
  await db.insert(toolRun).values({
    id,
    toolSlug: params.toolSlug,
    userId: params.userId,
    threadId: params.threadId ?? null,
    source: params.source,
    inputJson: params.inputJson,
    status: "pending",
  });
  return id;
}

export async function recordUserToolRunSuccess(params: {
  runId: string;
  outputJson: Record<string, unknown>;
}) {
  await db.update(toolRun).set({
    status: "success",
    outputJson: params.outputJson,
    completedAt: new Date(),
  }).where(eq(toolRun.id, params.runId));
}

export async function recordUserToolArtifacts(params: {
  runId: string;
  artifacts: Array<{
    kind: string;
    format: string;
    storageUrl?: string | null;
    payloadJson?: Record<string, unknown> | null;
  }>;
}) {
  if (params.artifacts.length === 0) {
    return;
  }

  await db.insert(toolArtifact).values(
    params.artifacts.map((artifact) => ({
      id: nanoid(),
      toolRunId: params.runId,
      kind: artifact.kind,
      format: artifact.format,
      storageUrl: artifact.storageUrl ?? null,
      payloadJson: artifact.payloadJson ?? null,
    })),
  );
}

export async function recordUserToolRunError(params: {
  runId: string;
  errorMessage: string;
  outputJson?: Record<string, unknown>;
}) {
  await db.update(toolRun).set({
    status: "error",
    errorMessage: params.errorMessage,
    outputJson: params.outputJson ?? null,
    completedAt: new Date(),
  }).where(eq(toolRun.id, params.runId));
}
