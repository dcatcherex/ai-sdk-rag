export type {
  ExternalProvider,
  ExternalToolProviderMetadata,
  NormalizedRunResult,
  ProviderArtifact,
  ProviderError,
  ProviderManifest,
  ProviderRequestEnvelope,
  ProviderResponseEnvelope,
  ProviderResponseStatus,
  ProviderRunOptions,
  ProviderUsage,
  ToolExecutionMode,
  ToolProviderHealthStatus,
} from './types';

export { checkProviderHealth, runExternalTool } from './service';
export { normalizeRunResult, toToolExecutionResult } from './normalize';
export { createProviderClient, ProviderClient } from './provider-client';
export { getProviderByKey, getProviderForTool, getAllProviders, registerProvider } from './registry';
export {
  createProviderToolRun,
  completeProviderToolRun,
  failProviderToolRun,
  markProviderRunPending,
  persistProviderArtifacts,
} from './run-lifecycle';
export { mapProviderArtifact, mapProviderArtifacts } from './artifacts';
export {
  ExternalToolError,
  ProviderAuthError,
  ProviderSchemaError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  normalizeProviderError,
} from './errors';
export {
  providerHealthSchema,
  providerManifestSchema,
  providerRequestEnvelopeSchema,
  providerResponseEnvelopeSchema,
} from './schema';

// Phase 4: KIE media bridge
export { KIE_MEDIA_PROVIDER_METADATA } from './media/metadata';

// Phase 6: Vaja Web Publisher bridge
export { WEBSITE_BUILDER_PROVIDER_METADATA, WEB_DEPLOY_PROVIDER_METADATA } from './web-publisher/metadata';
export {
  fromWebDeployResult,
  fromWebsiteBuilderResult,
  toWebDeployProviderOptions,
  toWebsiteBuilderProviderOptions,
  type WebDeployOperation,
  type WebsiteBuilderOperation,
} from './web-publisher/web-bridge';

// Phase 5: Google Workspace integrations bridge
export { GOOGLE_WORKSPACE_PROVIDER_METADATA } from './integrations/metadata';
export {
  fromGoogleDocsResult,
  fromGoogleDriveResult,
  fromGoogleSheetsResult,
  fromGoogleSlidesResult,
  toGoogleDocsProviderOptions,
  toGoogleDriveProviderOptions,
  toGoogleSheetsProviderOptions,
  toGoogleSlidesProviderOptions,
  type GoogleDocsOperation,
  type GoogleDriveOperation,
  type GoogleSheetsOperation,
  type GoogleSlidesOperation,
} from './integrations/google-bridge';

// Phase 3: async job lifecycle
export { verifyHmacSignature } from './callback-crypto';
export {
  verifyCallbackSignature,
  findRunByProviderRunId,
  processProviderCallback,
  type CallbackResult,
} from './callbacks';
export { normalizeToolRunRecord, type ExternalRunStatus } from './status-normalize';
export { getExternalRunStatus } from './status';
export { pollExternalRun } from './polling';
