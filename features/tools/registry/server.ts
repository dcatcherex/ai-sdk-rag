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
