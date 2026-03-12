/**
 * Certificate service — canonical business logic.
 * Re-exports the service layer from lib/certificate-service.ts so that
 * agent adapters, API routes, and sidebar all import from one place.
 *
 * As the codebase migrates, logic can move here from lib/certificate-service.ts.
 */

export {
  generateCertificateOutput,
  previewCertificateGeneration,
  listUserCertificateTemplates,
  type CertificateJobSource,
} from '@/lib/certificate-service';
