export const DEFAULT_WINDOW_DAYS = parsePositiveInt(
  process.env.USAGE_MONITORING_DEFAULT_WINDOW_DAYS,
  7,
);

export const WARNING_PERCENT = parsePositiveInt(
  process.env.USAGE_ALERT_WARNING_PERCENT,
  70,
);

export const CRITICAL_PERCENT = parsePositiveInt(
  process.env.USAGE_ALERT_CRITICAL_PERCENT,
  90,
);

export const usageLimitConfig = {
  vercelBandwidthBytes: parseOptionalInt(process.env.USAGE_LIMIT_VERCEL_BANDWIDTH_BYTES),
  vercelFunctionInvocations: parseOptionalInt(process.env.USAGE_LIMIT_VERCEL_FUNCTION_INVOCATIONS),
  neonStorageBytes: parseOptionalInt(process.env.USAGE_LIMIT_NEON_STORAGE_BYTES),
  neonComputeSeconds: parseOptionalInt(process.env.USAGE_LIMIT_NEON_COMPUTE_SECONDS),
  r2StorageBytes: parseOptionalInt(process.env.USAGE_LIMIT_R2_STORAGE_BYTES),
  r2ClassARequests: parseOptionalInt(process.env.USAGE_LIMIT_R2_CLASS_A_REQUESTS),
  r2ClassBRequests: parseOptionalInt(process.env.USAGE_LIMIT_R2_CLASS_B_REQUESTS),
} as const;

function parseOptionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
