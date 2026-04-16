import { usageLimitConfig } from '@/features/admin/usage/config';
import { createMetric, createUnavailableSnapshot, withProviderStatus } from '@/features/admin/usage/normalizers';
import type { UsageProviderSnapshot } from '@/features/admin/usage/types';

export async function getVercelUsageSnapshot(windowDays: number): Promise<UsageProviderSnapshot> {
  const collectedAt = new Date().toISOString();
  const token = process.env.VERCEL_MONITORING_TOKEN;
  const projectId = process.env.VERCEL_MONITORING_PROJECT_ID;

  if (!token || !projectId) {
    return createUnavailableSnapshot({
      provider: 'vercel',
      label: 'Vercel',
      note: 'Missing VERCEL_MONITORING_TOKEN or VERCEL_MONITORING_PROJECT_ID. Vercel monitoring remains partial until a verified metrics integration is configured.',
      collectedAt,
    });
  }

  const metrics = [
    createMetric({
      key: 'function-invocations-estimate',
      label: `Function invocations (${windowDays}d)` ,
      value: 0,
      unit: 'requests',
      limit: usageLimitConfig.vercelFunctionInvocations,
      status: 'manual',
      updatedAt: collectedAt,
      note: 'Placeholder metric. Verify a stable Vercel usage API before replacing this with live account data.',
    }),
    createMetric({
      key: 'bandwidth-estimate',
      label: `Bandwidth (${windowDays}d)`,
      value: 0,
      unit: 'bytes',
      limit: usageLimitConfig.vercelBandwidthBytes,
      status: 'manual',
      updatedAt: collectedAt,
      note: 'Placeholder metric. Verify a stable Vercel usage API before replacing this with live account data.',
    }),
  ];

  return withProviderStatus({
    provider: 'vercel',
    label: 'Vercel',
    collectedAt,
    metrics,
    alerts: [
      {
        id: 'vercel-manual-integration',
        provider: 'vercel',
        level: 'info',
        title: 'Vercel monitoring is partial',
        message: 'This adapter is intentionally conservative until a verified Vercel metrics integration is implemented.',
      },
    ],
    rawAvailable: false,
    fallbackStatus: 'manual',
  });
}
