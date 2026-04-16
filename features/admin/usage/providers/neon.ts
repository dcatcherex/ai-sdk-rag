import { usageLimitConfig } from '@/features/admin/usage/config';
import { buildThresholdAlerts, createMetric, createUnavailableSnapshot, withProviderStatus } from '@/features/admin/usage/normalizers';
import type { UsageProviderSnapshot } from '@/features/admin/usage/types';

type NeonProjectMetricRow = {
  metrics?: {
    compute_time_seconds?: number;
    synthetic_storage_size_bytes?: number;
    active_time_seconds?: number;
  };
};

type NeonConsumptionResponse = {
  projects?: NeonProjectMetricRow[];
};

export async function getNeonUsageSnapshot(windowDays: number): Promise<UsageProviderSnapshot> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const orgId = process.env.NEON_ORG_ID;
  const collectedAt = new Date().toISOString();

  if (!apiKey || !projectId) {
    return createUnavailableSnapshot({
      provider: 'neon',
      label: 'Neon',
      note: 'Missing NEON_API_KEY or NEON_PROJECT_ID for live Neon usage monitoring.',
      collectedAt,
    });
  }

  const endInclusive = new Date();
  const startInclusive = new Date(endInclusive.getTime() - Math.max(1, windowDays - 1) * 86400000);
  const url = new URL('https://console.neon.tech/api/v2/consumption_history/v2/projects');
  url.searchParams.set('from', startInclusive.toISOString());
  url.searchParams.set('to', endInclusive.toISOString());
  url.searchParams.set('granularity', 'daily');
  url.searchParams.set('project_ids', projectId);
  url.searchParams.set('metrics', 'compute_time_seconds,synthetic_storage_size_bytes,active_time_seconds');
  if (orgId) {
    url.searchParams.set('org_id', orgId);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return createUnavailableSnapshot({
        provider: 'neon',
        label: 'Neon',
        note: `Neon usage request failed with status ${res.status}.`,
        collectedAt,
      });
    }

    const data = (await res.json()) as NeonConsumptionResponse;
    const rows = data.projects ?? [];

    const computeSeconds = rows.reduce(
      (sum, row) => sum + Number(row.metrics?.compute_time_seconds ?? 0),
      0,
    );

    const activeSeconds = rows.reduce(
      (sum, row) => sum + Number(row.metrics?.active_time_seconds ?? 0),
      0,
    );

    const storageBytes = rows.reduce(
      (max, row) => Math.max(max, Number(row.metrics?.synthetic_storage_size_bytes ?? 0)),
      0,
    );

    const metrics = [
      createMetric({
        key: 'storage-bytes',
        label: 'Storage used',
        value: storageBytes,
        unit: 'bytes',
        limit: usageLimitConfig.neonStorageBytes,
        status: 'live',
        updatedAt: collectedAt,
        note: 'Queried from Neon consumption history.',
      }),
      createMetric({
        key: 'compute-seconds',
        label: `Compute usage (${windowDays}d)`,
        value: computeSeconds,
        unit: 'seconds',
        limit: usageLimitConfig.neonComputeSeconds,
        status: 'live',
        updatedAt: collectedAt,
        note: 'Queried from Neon consumption history.',
      }),
      createMetric({
        key: 'active-seconds',
        label: `Active time (${windowDays}d)`,
        value: activeSeconds,
        unit: 'seconds',
        status: 'live',
        updatedAt: collectedAt,
        note: 'Neon consumption polling does not wake suspended compute.',
      }),
    ];

    return withProviderStatus({
      provider: 'neon',
      label: 'Neon',
      collectedAt,
      metrics,
      alerts: buildThresholdAlerts('neon', 'Neon', metrics),
      rawAvailable: rows.length > 0,
    });
  } catch (error) {
    return createUnavailableSnapshot({
      provider: 'neon',
      label: 'Neon',
      note: error instanceof Error ? error.message : 'Unknown Neon monitoring error.',
      collectedAt,
    });
  }
}
