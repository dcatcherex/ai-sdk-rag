export type ExternalRunStatus = {
  vajaRunId: string;
  toolSlug: string;
  status: string;
  providerRunId?: string;
  providerKey?: string;
  title?: string;
  summary?: string;
  artifacts: Array<{ kind: string; format: string; url: string; label?: string }>;
  error?: string;
  createdAt: string;
  completedAt: string | null;
};

type StoredOutput = {
  providerRunId?: string;
  title?: string;
  summary?: string;
  error?: { message?: string };
};

type StoredInput = {
  _provider?: string;
};

/**
 * Normalize a raw toolRun DB row + its artifact rows into ExternalRunStatus.
 * Pure function — no DB imports, fully testable.
 */
export function normalizeToolRunRecord(
  run: {
    id: string;
    toolSlug: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
  },
  artifacts: Array<{ kind: string; format: string; storageUrl: string | null; payloadJson: unknown }>,
): ExternalRunStatus {
  const output = (run.outputJson ?? {}) as StoredOutput;
  const input = (run.inputJson ?? {}) as StoredInput;

  return {
    vajaRunId: run.id,
    toolSlug: run.toolSlug,
    status: run.status,
    providerRunId: output.providerRunId,
    providerKey: input._provider,
    title: output.title,
    summary: output.summary,
    artifacts: artifacts.map((a) => {
      const payload = (a.payloadJson ?? {}) as { label?: string };
      return {
        kind: a.kind,
        format: a.format,
        url: a.storageUrl ?? '',
        label: payload.label,
      };
    }),
    error: run.errorMessage ?? output.error?.message,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}
