import { z } from 'zod';

export const providerArtifactSchema = z.object({
  artifactId: z.string().optional(),
  kind: z.string(),
  format: z.string(),
  url: z.string().url(),
  label: z.string().optional(),
});

export const providerUsageSchema = z.object({
  computeUnits: z.number().optional(),
  durationMs: z.number().optional(),
  providerCost: z.number().optional(),
});

export const providerErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

export const providerResponseEnvelopeSchema = z.object({
  providerRunId: z.string(),
  status: z.enum(['success', 'pending', 'failed', 'cancelled']),
  title: z.string().optional(),
  summary: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  artifacts: z.array(providerArtifactSchema).optional(),
  usage: providerUsageSchema.optional(),
  error: providerErrorSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const providerRequestEnvelopeSchema = z.object({
  requestId: z.string(),
  idempotencyKey: z.string(),
  vajaRunId: z.string(),
  toolSlug: z.string(),
  source: z.enum(['agent', 'sidebar', 'api', 'line']),
  userRef: z.string(),
  workspaceRef: z.string().optional(),
  threadRef: z.string().optional(),
  lineRef: z.string().optional(),
  input: z.record(z.string(), z.unknown()),
  artifacts: z.array(z.object({ artifactId: z.string(), signedUrl: z.string().optional() })).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const providerManifestSchema = z.object({
  providerId: z.string(),
  providerVersion: z.string(),
  toolSlug: z.string(),
  displayName: z.string(),
  executionModes: z.array(z.enum(['sync', 'async'])),
  timeoutMs: z.number().positive(),
  supportsIdempotency: z.boolean(),
  requiredPermissions: z.array(z.string()),
  billingHints: z.object({ estimatedCreditCost: z.number().optional() }).optional(),
  configureUrl: z.string().url().optional(),
});

export const providerHealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string().optional(),
  checkedAt: z.string().optional(),
});

export type ProviderResponseEnvelopeInput = z.input<typeof providerResponseEnvelopeSchema>;
export type ProviderHealthResponse = z.infer<typeof providerHealthSchema>;
