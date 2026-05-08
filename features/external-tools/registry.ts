import type { ExternalProvider } from './types';

// Server-only: never import this in client components.
// Add first-party external providers here as they are built.

// Providers are auto-registered at module load time when their URL env var is set.

const PROVIDER_REGISTRY: ExternalProvider[] = [];

const certificateProviderUrl = process.env.CERTIFICATE_PROVIDER_URL;
if (certificateProviderUrl) {
  PROVIDER_REGISTRY.push({
    key: 'certificate',
    baseUrl: certificateProviderUrl,
    tools: ['certificate'],
    providerMetadata: {
      providerKey: 'certificate',
      executionMode: 'external',
      supportsSync: true,
      supportsAsync: false,
      supportsConfigureUrl: false,
      supportsHealthCheck: true,
      estimatedCreditCost: 2,
      allowedSources: ['agent', 'sidebar', 'api'],
    },
  });
}

const googleIntegrationsProviderUrl = process.env.GOOGLE_INTEGRATIONS_PROVIDER_URL;
if (googleIntegrationsProviderUrl) {
  PROVIDER_REGISTRY.push({
    key: 'google-workspace',
    baseUrl: googleIntegrationsProviderUrl,
    tools: ['google-sheets', 'google-docs', 'google-drive', 'google-slides'],
    providerMetadata: {
      providerKey: 'google-workspace',
      executionMode: 'external',
      supportsSync: true,
      supportsAsync: false,
      supportsConfigureUrl: false,
      supportsHealthCheck: true,
      allowedSources: ['agent', 'sidebar', 'api'],
    },
  });
}

const webPublisherUrl = process.env.WEB_PUBLISHER_URL;
if (webPublisherUrl) {
  PROVIDER_REGISTRY.push({
    key: 'web-publisher',
    baseUrl: webPublisherUrl,
    tools: ['website-builder', 'web-deploy'],
    providerMetadata: {
      providerKey: 'web-publisher',
      executionMode: 'hybrid',
      supportsSync: true,
      supportsAsync: true,
      supportsConfigureUrl: false,
      supportsHealthCheck: true,
      allowedSources: ['agent', 'sidebar', 'api'],
    },
  });
}

export function getProviderForTool(toolSlug: string): ExternalProvider | undefined {
  return PROVIDER_REGISTRY.find((p) => p.tools.includes(toolSlug));
}

export function getProviderByKey(key: string): ExternalProvider | undefined {
  return PROVIDER_REGISTRY.find((p) => p.key === key);
}

export function getAllProviders(): ExternalProvider[] {
  return PROVIDER_REGISTRY;
}

export function registerProvider(provider: ExternalProvider): void {
  const existing = PROVIDER_REGISTRY.findIndex((p) => p.key === provider.key);
  if (existing >= 0) {
    PROVIDER_REGISTRY[existing] = provider;
  } else {
    PROVIDER_REGISTRY.push(provider);
  }
}
