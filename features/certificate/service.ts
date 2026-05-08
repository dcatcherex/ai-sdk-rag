/**
 * Certificate service — canonical business logic.
 *
 * generateCertificateOutput is the one place both agent adapters and API routes
 * call for certificate generation. When CERTIFICATE_PROVIDER_URL is set it
 * routes through the external provider adapter; otherwise it falls back to the
 * local implementation in lib/certificate-service.
 *
 * All other functions (preview, list) remain local — they don't need to be
 * externalized because they don't produce heavy output.
 */

export {
  previewCertificateGeneration,
  listUserCertificateTemplates,
  listCertificateJobs,
  type CertificateJobSource,
  type CertificateGenerationResult,
  type CertificateGenerationPreview,
  type CertificateOutputFormat,
  type CertificateOutputMode,
  type CertificateRecipientInput,
} from '@/lib/certificate-service';

import {
  generateCertificateOutput as generateLocal,
  type CertificateGenerationResult,
} from '@/lib/certificate-service';
import { runExternalTool } from '@/features/external-tools/service';
import { fromProviderResult, toCertificateProviderOptions } from './provider-adapter';
import type { CertificateGenerateOptions } from './provider-adapter';

export type { CertificateGenerateOptions };

/**
 * Generate certificate output — local or external depending on env.
 *
 * Set CERTIFICATE_PROVIDER_URL to the provider base URL to enable external mode.
 * Leave it unset (or empty) to use the local rendering path.
 */
export async function generateCertificateOutput(
  opts: CertificateGenerateOptions,
): Promise<CertificateGenerationResult> {
  const providerUrl = process.env.CERTIFICATE_PROVIDER_URL;

  if (providerUrl) {
    const providerOpts = toCertificateProviderOptions(opts);
    const result = await runExternalTool(providerOpts);
    return fromProviderResult(result);
  }

  return generateLocal({
    fillerTemplateId: opts.fillerTemplateId,
    format: opts.format,
    maxRecipients: opts.maxRecipients,
    outputMode: opts.outputMode,
    padToGrid: opts.padToGrid,
    pdfQuality: opts.pdfQuality as 'standard' | 'high' | undefined,
    recipients: opts.recipients,
    source: opts.source,
    templateId: opts.templateId,
    userId: opts.userId,
  });
}
