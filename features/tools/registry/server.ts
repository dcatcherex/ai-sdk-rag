/**
 * Server-only tool registry.
 * Imports agent adapters (service.ts / agent.ts) — NOT safe for client bundles.
 * Used by API routes and the chat agent tool builder.
 */

import type { AgentToolContext, RegisteredTool } from './types';
import { TOOL_MANIFESTS } from './client';
import { quizManifest } from '@/features/quiz/manifest';
import { certificateManifest } from '@/features/certificate/manifest';
import { contentMarketingManifest } from '@/features/content-marketing/manifest';
import { websiteBuilderManifest } from '@/features/website-builder/manifest';
import { createQuizAgentTools } from '@/features/quiz/agent';
import { createCertificateAgentTools } from '@/features/certificate/agent';
import { createContentMarketingAgentTools } from '@/features/content-marketing/agent';
import { createWebsiteBuilderAgentTools } from '@/features/website-builder/agent';
import { examBuilderManifest } from '@/features/exam-builder/manifest';
import { createExamBuilderAgentTools } from '@/features/exam-builder/agent';
import { audioManifest } from '@/features/audio/manifest';
import { speechManifest } from '@/features/speech/manifest';
import { videoManifest } from '@/features/video/manifest';
import { createAudioAgentTools } from '@/features/audio/agent';
import { createSpeechAgentTools } from '@/features/speech/agent';
import { createVideoAgentTools } from '@/features/video/agent';
import { imageManifest } from '@/features/image/manifest';
import { createImageAgentTools } from '@/features/image/agent';
import { longFormManifest } from '@/features/long-form/manifest';
import { createLongFormAgentTools } from '@/features/long-form/agent';
import { repurposingManifest } from '@/features/repurposing/manifest';
import { createRepurposingAgentTools } from '@/features/repurposing/agent';

const SERVER_REGISTRY: RegisteredTool[] = [
  {
    manifest: quizManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createQuizAgentTools({
        documentIds: ctx.documentIds,
        rerankEnabled: ctx.rerankEnabled,
      }),
    getSidebarPageHref: () => `/tools/${quizManifest.slug}`,
  },
  {
    manifest: certificateManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createCertificateAgentTools({
        userId: ctx.userId,
        source: ctx.source,
        maxRecipients: ctx.toolOptions?.certificateMaxRecipients,
      }),
    getSidebarPageHref: () => `/tools/${certificateManifest.slug}`,
  },
  {
    manifest: contentMarketingManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createContentMarketingAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${contentMarketingManifest.slug}`,
  },
  {
    manifest: websiteBuilderManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createWebsiteBuilderAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${websiteBuilderManifest.slug}`,
  },
  {
    manifest: examBuilderManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createExamBuilderAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${examBuilderManifest.slug}`,
  },
  {
    manifest: audioManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createAudioAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${audioManifest.slug}`,
  },
  {
    manifest: speechManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createSpeechAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${speechManifest.slug}`,
  },
  {
    manifest: videoManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createVideoAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${videoManifest.slug}`,
  },
  {
    manifest: imageManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createImageAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${imageManifest.slug}`,
  },
  {
    manifest: longFormManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createLongFormAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${longFormManifest.slug}`,
  },
  {
    manifest: repurposingManifest,
    getAgentDefinition: (ctx: AgentToolContext) =>
      createRepurposingAgentTools({ userId: ctx.userId }),
    getSidebarPageHref: () => `/tools/${repurposingManifest.slug}`,
  },
];

const SERVER_REGISTRY_BY_ID = Object.fromEntries(
  SERVER_REGISTRY.map((r) => [r.manifest.id, r]),
) as Record<string, RegisteredTool>;

/**
 * Build the agent tool set from registered tools.
 * Replaces the per-tool conditionals in lib/tools/index.ts for registry-managed tools.
 */
export function buildRegistryAgentTools(
  enabledToolIds: string[],
  ctx: AgentToolContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const id of enabledToolIds) {
    const entry = SERVER_REGISTRY_BY_ID[id];
    if (!entry?.manifest.access.enabled) continue;
    if (!entry.getAgentDefinition) continue;

    const tools = entry.getAgentDefinition(ctx);
    Object.assign(result, tools);
  }

  return result;
}

export { SERVER_REGISTRY, SERVER_REGISTRY_BY_ID, TOOL_MANIFESTS };
