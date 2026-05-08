import type { ExternalToolProviderMetadata } from '@/features/external-tools/types';

/**
 * Shared provider metadata for all Google Workspace connector tools.
 * Apply to google-sheets, google-docs, google-drive, google-slides manifests.
 *
 * executionMode: 'external' — when GOOGLE_INTEGRATIONS_PROVIDER_URL is set,
 * action functions route through runExternalTool() instead of local lib/google/*
 * calls. OAuth token management and Google API retries live in the provider.
 */
export const GOOGLE_WORKSPACE_PROVIDER_METADATA: ExternalToolProviderMetadata = {
  providerKey: 'google-workspace',
  executionMode: 'external',
  supportsSync: true,
  supportsAsync: false,
  supportsConfigureUrl: false,
  supportsHealthCheck: true,
  allowedSources: ['agent', 'sidebar', 'api'],
};
