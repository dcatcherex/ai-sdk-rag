import { CRITICAL_PERCENT, WARNING_PERCENT } from '@/features/admin/usage/config';
import type {
  UsageAlert,
  UsageAlertLevel,
  UsageMetric,
  UsageMetricStatus,
  UsageProviderKey,
  UsageProviderSnapshot,
  UsageValueUnit,
} from '@/features/admin/usage/types';

export function createMetric(input: {
  key: string;
  label: string;
  value: number;
  unit: UsageValueUnit;
  limit?: number | null;
  status: UsageMetricStatus;
  updatedAt: string;
  note?: string | null;
}): UsageMetric {
  const limit = input.limit ?? null;
  const percentOfLimit = limit && limit > 0 ? Math.min(999, Math.round((input.value / limit) * 1000) / 10) : null;

  return {
    key: input.key,
    label: input.label,
    value: input.value,
    unit: input.unit,
    limit,
    percentOfLimit,
    status: input.status,
    updatedAt: input.updatedAt,
    note: input.note ?? null,
  };
}

export function buildThresholdAlerts(
  provider: UsageProviderKey,
  label: string,
  metrics: UsageMetric[],
): UsageAlert[] {
  return metrics.flatMap((metric) => {
    if (metric.percentOfLimit == null) return [];

    if (metric.percentOfLimit >= CRITICAL_PERCENT) {
      return [
        createAlert({
          id: `${provider}-${metric.key}-critical`,
          provider,
          level: 'critical',
          title: `${label} nearing limit`,
          message: `${metric.label} is at ${formatPercent(metric.percentOfLimit)} of the configured limit.`,
        }),
      ];
    }

    if (metric.percentOfLimit >= WARNING_PERCENT) {
      return [
        createAlert({
          id: `${provider}-${metric.key}-warning`,
          provider,
          level: 'warning',
          title: `${label} usage elevated`,
          message: `${metric.label} is at ${formatPercent(metric.percentOfLimit)} of the configured limit.`,
        }),
      ];
    }

    return [];
  });
}

export function createUnavailableSnapshot(input: {
  provider: UsageProviderKey;
  label: string;
  note: string;
  collectedAt: string;
}): UsageProviderSnapshot {
  return {
    provider: input.provider,
    label: input.label,
    status: 'unavailable',
    collectedAt: input.collectedAt,
    metrics: [],
    alerts: [
      createAlert({
        id: `${input.provider}-unavailable`,
        provider: input.provider,
        level: 'info',
        title: `${input.label} unavailable`,
        message: input.note,
      }),
    ],
    rawAvailable: false,
  };
}

export function withProviderStatus(input: {
  provider: UsageProviderKey;
  label: string;
  collectedAt: string;
  metrics: UsageMetric[];
  alerts?: UsageAlert[];
  rawAvailable: boolean;
  fallbackStatus?: UsageMetricStatus;
}): UsageProviderSnapshot {
  const alerts = input.alerts ?? [];
  const status = deriveProviderStatus(input.metrics, alerts, input.fallbackStatus ?? 'live');

  return {
    provider: input.provider,
    label: input.label,
    status,
    collectedAt: input.collectedAt,
    metrics: input.metrics,
    alerts,
    rawAvailable: input.rawAvailable,
  };
}

export function deriveProviderStatus(
  metrics: UsageMetric[],
  alerts: UsageAlert[],
  fallback: UsageMetricStatus,
): UsageMetricStatus {
  if (!metrics.length) return fallback;

  if (metrics.some((metric) => metric.status === 'unavailable')) return 'unavailable';
  if (metrics.some((metric) => metric.status === 'partial')) return 'partial';
  if (metrics.some((metric) => metric.status === 'estimated')) return 'estimated';
  if (metrics.some((metric) => metric.status === 'manual')) return 'manual';
  if (alerts.some((alert) => alert.level === 'critical' || alert.level === 'warning')) return 'live';
  return metrics.every((metric) => metric.status === 'live') ? 'live' : fallback;
}

export function createAlert(input: {
  id: string;
  provider: UsageProviderKey;
  level: UsageAlertLevel;
  title: string;
  message: string;
}): UsageAlert {
  return input;
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
