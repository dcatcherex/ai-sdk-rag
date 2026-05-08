import type { ExternalToolProviderMetadata } from '@/features/external-tools/types';

/**
 * Shared provider metadata for all KIE-backed media tools.
 * Apply to image, video, audio, speech manifests to classify them as hybrid.
 *
 * executionMode: 'hybrid' — Vaja owns the job lifecycle and artifact storage;
 * KIE owns the computation. We do not route through runExternalTool() because
 * KIE speaks its own protocol, not the Vaja provider contract.
 */
export const KIE_MEDIA_PROVIDER_METADATA: ExternalToolProviderMetadata = {
  providerKey: 'kie',
  executionMode: 'hybrid',
  supportsSync: false,
  supportsAsync: true,
  supportsConfigureUrl: false,
  supportsHealthCheck: false,
  allowedSources: ['agent', 'sidebar', 'api', 'line'],
};
