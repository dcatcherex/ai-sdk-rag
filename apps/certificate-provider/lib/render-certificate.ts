/**
 * Certificate rendering for the external provider.
 *
 * This module is the execution plane: it receives a validated certificate
 * request and returns a rendered output with a persistent URL.
 *
 * For the Phase 2 tracer bullet, this calls back to the Vaja main app's
 * certificate service via an internal API route. In a future phase this
 * module will own the full rendering pipeline (sharp, pdf-lib, R2 upload)
 * independently of the main application.
 *
 * To use standalone rendering, replace renderCertificate with your own
 * implementation of the rendering logic found in:
 *   lib/certificate-generator.ts
 *   lib/certificate-service.ts
 *   lib/certificate-print.ts
 */

import type { CertificateInput } from './provider-contract';

export type RenderResult = {
  jobId: string;
  count: number;
  downloadLabel: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  format: string;
  outputMode: string;
};

export async function renderCertificate(
  userRef: string,
  input: CertificateInput,
  idempotencyKey: string,
): Promise<RenderResult> {
  const vajaApiUrl = process.env.VAJA_API_URL;
  const vajaApiSecret = process.env.VAJA_PROVIDER_SECRET;

  if (!vajaApiUrl || !vajaApiSecret) {
    throw new Error(
      'VAJA_API_URL and VAJA_PROVIDER_SECRET must be set for the certificate provider tracer bullet. ' +
        'These allow the provider to delegate rendering back to the main Vaja app during Phase 2.',
    );
  }

  // During the tracer bullet phase, delegate rendering back to the main app.
  // The main app's /api/certificate/batch route handles the actual rendering.
  const res = await fetch(`${vajaApiUrl}/api/certificate/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Provider-Secret': vajaApiSecret,
      'X-Idempotency-Key': idempotencyKey,
      'X-User-Id': userRef,
    },
    body: JSON.stringify({
      templateId: input.templateId,
      recipients: input.recipients,
      format: input.format,
      exportMode: input.outputMode ?? 'zip',
      pdfQuality: input.pdfQuality,
      padToGrid: input.padToGrid,
      fillerTemplateId: input.fillerTemplateId,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error');
    throw new Error(`Vaja rendering failed: ${res.status} — ${text.slice(0, 200)}`);
  }

  const body = await res.json() as {
    jobId: string;
    fileKey: string;
    fileName: string;
    fileUrl: string;
    count: number;
    downloadLabel: string;
  };

  return {
    jobId: body.jobId,
    count: body.count,
    downloadLabel: body.downloadLabel,
    fileKey: body.fileKey,
    fileName: body.fileName,
    fileUrl: body.fileUrl,
    format: input.format,
    outputMode: input.outputMode ?? (input.recipients.length === 1 ? 'single_file' : 'zip'),
  };
}
