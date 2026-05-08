/**
 * In-memory job store for async runs during the tracer bullet phase.
 * Replace with a persistent store (Redis, Postgres) for production.
 */

export type JobState = {
  providerRunId: string;
  idempotencyKey: string;
  status: 'pending' | 'success' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

const store = new Map<string, JobState>();

export function setJob(id: string, state: JobState): void {
  store.set(id, state);
}

export function getJob(id: string): JobState | undefined {
  return store.get(id);
}

export function findByIdempotencyKey(key: string): JobState | undefined {
  for (const job of store.values()) {
    if (job.idempotencyKey === key) return job;
  }
  return undefined;
}
