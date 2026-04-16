export type UsageMetricStatus = 'live' | 'partial' | 'estimated' | 'manual' | 'unavailable';

export type UsageProviderKey = 'vercel' | 'neon' | 'r2' | 'internal-ai';

export type UsageValueUnit =
  | 'count'
  | 'bytes'
  | 'seconds'
  | 'ms'
  | 'credits'
  | 'tokens'
  | 'percent'
  | 'requests';

export type UsageMetric = {
  key: string;
  label: string;
  value: number;
  unit: UsageValueUnit;
  limit: number | null;
  percentOfLimit: number | null;
  status: UsageMetricStatus;
  updatedAt: string;
  note: string | null;
};

export type UsageAlertLevel = 'info' | 'warning' | 'critical';

export type UsageAlert = {
  id: string;
  provider: UsageProviderKey;
  level: UsageAlertLevel;
  title: string;
  message: string;
};

export type UsageProviderSnapshot = {
  provider: UsageProviderKey;
  label: string;
  status: UsageMetricStatus;
  collectedAt: string;
  metrics: UsageMetric[];
  alerts: UsageAlert[];
  rawAvailable: boolean;
};

export type AdminUsageResponse = {
  generatedAt: string;
  windowDays: number;
  providers: UsageProviderSnapshot[];
  summary: {
    healthyProviders: number;
    warningProviders: number;
    criticalProviders: number;
  };
};
