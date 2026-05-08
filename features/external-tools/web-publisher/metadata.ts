import type { ExternalToolProviderMetadata } from '@/features/external-tools/types';

/**
 * Provider metadata for the website-builder tool.
 * executionMode: 'hybrid' — generation uses LLM + Cloudflare Pages async deploy;
 * Vaja owns credit deduction and website records, provider owns rendering pipeline.
 */
export const WEBSITE_BUILDER_PROVIDER_METADATA: ExternalToolProviderMetadata = {
  providerKey: 'web-publisher',
  executionMode: 'hybrid',
  supportsSync: false,
  supportsAsync: true,
  supportsConfigureUrl: false,
  supportsHealthCheck: true,
  allowedSources: ['agent', 'sidebar', 'api'],
};

/**
 * Provider metadata for the web-deploy (Web Publisher) tool.
 * executionMode: 'external' — GitHub API calls and PR management live in the provider;
 * Vaja owns authorization, run history, and workspace context.
 */
export const WEB_DEPLOY_PROVIDER_METADATA: ExternalToolProviderMetadata = {
  providerKey: 'web-publisher',
  executionMode: 'external',
  supportsSync: true,
  supportsAsync: false,
  supportsConfigureUrl: false,
  supportsHealthCheck: true,
  allowedSources: ['agent', 'sidebar', 'api'],
};
