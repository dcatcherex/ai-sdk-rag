import type { ProviderError } from './types';

export class ExternalToolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly providerRunId?: string,
  ) {
    super(message);
    this.name = 'ExternalToolError';
  }
}

export class ProviderUnavailableError extends ExternalToolError {
  constructor(providerKey: string) {
    super(`Tool provider "${providerKey}" is currently unavailable`, 'PROVIDER_UNAVAILABLE', true);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderTimeoutError extends ExternalToolError {
  constructor(toolSlug: string, timeoutMs: number) {
    super(`Provider call for "${toolSlug}" timed out after ${timeoutMs}ms`, 'PROVIDER_TIMEOUT', true);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderAuthError extends ExternalToolError {
  constructor() {
    super('Provider authentication failed', 'PROVIDER_AUTH_FAILED', false);
    this.name = 'ProviderAuthError';
  }
}

export class ProviderSchemaError extends ExternalToolError {
  constructor(detail: string) {
    super(`Provider returned invalid response: ${detail}`, 'PROVIDER_SCHEMA_ERROR', false);
    this.name = 'ProviderSchemaError';
  }
}

// Convert any thrown value into a user-safe ProviderError without leaking secrets.
export function normalizeProviderError(err: unknown, defaultCode = 'PROVIDER_ERROR'): ProviderError {
  if (err instanceof ExternalToolError) {
    return { code: err.code, message: err.message, retryable: err.retryable };
  }

  if (err instanceof Error) {
    // Strip anything that looks like a token, key, or stack path.
    const safeMessage = sanitizeErrorMessage(err.message);
    const retryable = isLikelyRetryable(err);
    return { code: defaultCode, message: safeMessage, retryable };
  }

  return { code: defaultCode, message: 'An unexpected provider error occurred', retryable: true };
}

function sanitizeErrorMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]')
    .replace(/\/[^\s"']{30,}/g, '/[path redacted]')
    .slice(0, 256);
}

function isLikelyRetryable(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('429')
  );
}
