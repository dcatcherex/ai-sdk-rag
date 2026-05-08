import { z } from 'zod';

// ── Vaja request envelope ──────────────────────────────────────────────────────

export const certificateInputSchema = z.object({
  templateId: z.string(),
  recipients: z.array(
    z.object({
      values: z.union([
        z.array(z.object({ fieldId: z.string(), value: z.string() })),
        z.record(z.string(), z.string()),
      ]),
    }),
  ).min(1),
  format: z.enum(['png', 'jpg', 'pdf']).default('png'),
  pdfQuality: z.enum(['standard', 'high']).default('standard'),
  outputMode: z.enum(['zip', 'single_pdf', 'sheet_pdf']).optional(),
  padToGrid: z.boolean().optional(),
  fillerTemplateId: z.string().optional(),
  maxRecipients: z.number().int().positive().optional(),
});

export const providerRequestSchema = z.object({
  requestId: z.string(),
  idempotencyKey: z.string(),
  vajaRunId: z.string(),
  toolSlug: z.string(),
  source: z.enum(['agent', 'sidebar', 'api', 'line']),
  userRef: z.string(),
  threadRef: z.string().optional(),
  input: certificateInputSchema,
  callbackUrl: z.string().url().optional(),
});

export type ProviderRequest = z.infer<typeof providerRequestSchema>;
export type CertificateInput = z.infer<typeof certificateInputSchema>;

// ── Provider response envelope ─────────────────────────────────────────────────

export type ProviderArtifact = {
  kind: string;
  format: string;
  url: string;
  label?: string;
};

export type ProviderResponse = {
  providerRunId: string;
  status: 'success' | 'pending' | 'failed';
  title?: string;
  summary?: string;
  data?: {
    jobId: string;
    count: number;
    downloadLabel: string;
    fileKey: string;
    fileName: string;
    fileUrl: string;
    format: string;
    outputMode: string;
  };
  artifacts?: ProviderArtifact[];
  usage?: { durationMs: number };
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
  completedAt?: string;
};

// ── Provider manifest ──────────────────────────────────────────────────────────

export const PROVIDER_MANIFEST = {
  providerId: 'vaja-certificate',
  providerVersion: '0.1.0',
  toolSlug: 'certificate',
  displayName: 'Vaja Certificate Provider',
  executionModes: ['sync'] as const,
  timeoutMs: 120_000,
  supportsIdempotency: true,
  requiredPermissions: [],
  billingHints: { estimatedCreditCost: 2 },
};
