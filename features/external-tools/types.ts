export type ToolExecutionMode = 'local' | 'external' | 'hybrid';

export type ExternalToolProviderMetadata = {
  providerKey: string;
  executionMode: ToolExecutionMode;
  supportsSync: boolean;
  supportsAsync: boolean;
  supportsConfigureUrl: boolean;
  supportsHealthCheck: boolean;
  estimatedCreditCost?: number;
  requiredPermissions?: string[];
  allowedSources?: Array<'agent' | 'sidebar' | 'api' | 'line'>;
};

export type ToolProviderHealthStatus = {
  providerKey: string;
  healthy: boolean;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
};

export type ProviderArtifact = {
  artifactId?: string;
  kind: string;
  format: string;
  url: string;
  label?: string;
};

export type ProviderUsage = {
  computeUnits?: number;
  durationMs?: number;
  providerCost?: number;
};

export type ProviderError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ProviderRequestEnvelope = {
  requestId: string;
  idempotencyKey: string;
  vajaRunId: string;
  toolSlug: string;
  source: 'agent' | 'sidebar' | 'api' | 'line';
  userRef: string;
  workspaceRef?: string;
  threadRef?: string;
  lineRef?: string;
  input: Record<string, unknown>;
  artifacts?: Array<{ artifactId: string; signedUrl?: string }>;
  context?: Record<string, unknown>;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderResponseStatus = 'success' | 'pending' | 'failed' | 'cancelled';

export type ProviderResponseEnvelope = {
  providerRunId: string;
  status: ProviderResponseStatus;
  title?: string;
  summary?: string;
  data?: Record<string, unknown>;
  artifacts?: ProviderArtifact[];
  usage?: ProviderUsage;
  error?: ProviderError;
  createdAt: string;
  completedAt?: string;
};

export type ProviderManifest = {
  providerId: string;
  providerVersion: string;
  toolSlug: string;
  displayName: string;
  executionModes: Array<'sync' | 'async'>;
  timeoutMs: number;
  supportsIdempotency: boolean;
  requiredPermissions: string[];
  billingHints?: { estimatedCreditCost?: number };
  configureUrl?: string;
};

export type ExternalProvider = {
  key: string;
  baseUrl: string;
  tools: string[];
  providerMetadata: ExternalToolProviderMetadata;
  manifest?: ProviderManifest;
};

export type ProviderRunOptions = {
  userId: string;
  toolSlug: string;
  input: Record<string, unknown>;
  source: 'agent' | 'sidebar' | 'api' | 'line';
  threadId?: string;
  idempotencyKey?: string;
  callbackUrl?: string;
  context?: Record<string, unknown>;
};

export type NormalizedRunResult = {
  vajaRunId: string;
  providerRunId: string;
  status: ProviderResponseStatus;
  title: string;
  summary?: string;
  data?: Record<string, unknown>;
  artifacts?: ProviderArtifact[];
  usage?: ProviderUsage;
  error?: ProviderError;
  completedAt?: string;
};
