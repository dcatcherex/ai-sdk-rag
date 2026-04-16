import { DEFAULT_WINDOW_DAYS } from '@/features/admin/usage/config';
import { getInternalAiUsageSnapshot } from '@/features/admin/usage/providers/internal-ai';
import { getNeonUsageSnapshot } from '@/features/admin/usage/providers/neon';
import { getR2UsageSnapshot } from '@/features/admin/usage/providers/r2';
import { getVercelUsageSnapshot } from '@/features/admin/usage/providers/vercel';
import type { AdminUsageResponse, UsageProviderSnapshot } from '@/features/admin/usage/types';

export async function getAdminUsageSummary(windowDays = DEFAULT_WINDOW_DAYS): Promise<AdminUsageResponse> {
  const providers = await Promise.all([
    getVercelUsageSnapshot(windowDays),
    getNeonUsageSnapshot(windowDays),
    getR2UsageSnapshot(windowDays),
    getInternalAiUsageSnapshot(windowDays),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    providers,
    summary: summarizeProviders(providers),
  };
}

function summarizeProviders(providers: UsageProviderSnapshot[]) {
  let healthyProviders = 0;
  let warningProviders = 0;
  let criticalProviders = 0;

  for (const provider of providers) {
    const hasCritical = provider.alerts.some((alert) => alert.level === 'critical');
    const hasWarning = provider.alerts.some((alert) => alert.level === 'warning');

    if (hasCritical) {
      criticalProviders += 1;
      continue;
    }

    if (hasWarning) {
      warningProviders += 1;
      continue;
    }

    healthyProviders += 1;
  }

  return {
    healthyProviders,
    warningProviders,
    criticalProviders,
  };
}
