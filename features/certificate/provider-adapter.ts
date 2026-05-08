/**
 * Maps between certificate domain types and the generic external-tool provider envelope.
 * Used only when CERTIFICATE_PROVIDER_URL is set; local path bypasses this entirely.
 */
import type { CertificateField } from '@/lib/certificate-generator';
import type {
  CertificateGenerationResult,
  CertificateJobSource,
  CertificateOutputFormat,
  CertificateOutputMode,
  CertificateRecipientInput,
} from '@/lib/certificate-service';
import type { NormalizedRunResult, ProviderRunOptions } from '@/features/external-tools/types';

export type CertificateGenerateOptions = {
  fillerTemplateId?: string;
  format?: CertificateOutputFormat;
  maxRecipients?: number;
  outputMode?: Exclude<CertificateOutputMode, 'single_file'>;
  padToGrid?: boolean;
  pdfQuality?: string;
  recipients: CertificateRecipientInput[];
  source?: CertificateJobSource;
  templateId: string;
  userId: string;
  // Provider routing extras
  threadId?: string;
  idempotencyKey?: string;
};

export function toCertificateProviderOptions(opts: CertificateGenerateOptions): ProviderRunOptions {
  return {
    userId: opts.userId,
    toolSlug: 'certificate',
    source: opts.source === 'agent' ? 'agent' : 'sidebar',
    threadId: opts.threadId,
    idempotencyKey: opts.idempotencyKey,
    input: {
      templateId: opts.templateId,
      recipients: opts.recipients.map((r) => ({
        values: Array.isArray(r.values)
          ? r.values
          : Object.entries(r.values).map(([fieldId, value]) => ({ fieldId, value })),
      })),
      format: opts.format ?? 'png',
      pdfQuality: opts.pdfQuality ?? 'standard',
      outputMode: opts.outputMode,
      padToGrid: opts.padToGrid ?? false,
      fillerTemplateId: opts.fillerTemplateId,
      maxRecipients: opts.maxRecipients,
    },
  };
}

export function fromProviderResult(result: NormalizedRunResult): CertificateGenerationResult {
  const d = result.data ?? {};
  const artifact = result.artifacts?.[0];
  return {
    jobId: (d.jobId as string | undefined) ?? result.vajaRunId,
    count: (d.count as number | undefined) ?? 1,
    downloadLabel: (d.downloadLabel as string | undefined) ?? result.title,
    fileKey: (d.fileKey as string | undefined) ?? '',
    fileName: (d.fileName as string | undefined) ?? artifact?.label ?? 'certificate',
    fileUrl: (d.fileUrl as string | undefined) ?? artifact?.url ?? '',
    format: (d.format as CertificateOutputFormat | undefined) ?? 'png',
    outputMode: (d.outputMode as CertificateOutputMode | undefined) ?? 'single_file',
  };
}
