import type { ToolSet } from 'ai';
import { buildToolSet } from '@/lib/tools/index';

type RunToolsAgent = {
  id: string;
  mcpServers?: Array<{
    name: string;
    url: string;
    description?: string;
    authType?: 'none' | 'bearer' | 'api_key';
    credentialKey?: string;
  }>;
};

// ── Unified tool builder ───────────────────────────────────────────────────────

export type ToolBuildInput = {
  userId: string;
  enabledToolIds: string[] | null;
  /** When set, applies agent-specific settings (certificateMaxRecipients: 50). */
  agentId?: string | null;
  brandId?: string | null;
  documentIds?: string[];
  rerankEnabled?: boolean;
  threadId?: string;
  referenceImageUrls?: string[];
};

export type RunToolAdapterInput = {
  enabledToolIds: string[] | null;
  userId: string;
  agentId?: string | null;
  brandId?: string;
  documentIds?: string[];
  rerankEnabled?: boolean;
  threadId: string;
  referenceImageUrls?: string[];
};

export type RunToolAdapter = (input: RunToolAdapterInput) => ToolSet | Promise<ToolSet>;

/**
 * Single entry point for building a ToolSet across chat, agent, and team runs.
 *
 * Replaces the old `createAgentTools` / `buildToolSet` split.
 * Both paths now go through the same `buildToolSet` call with the agent-specific
 * settings (certificateMaxRecipients) applied when `agentId` is present.
 */
export function buildToolsForRun(input: ToolBuildInput): ToolSet {
  return buildToolSet({
    enabledToolIds: input.enabledToolIds,
    userId: input.userId,
    brandId: input.brandId ?? undefined,
    documentIds: input.documentIds,
    rerankEnabled: input.rerankEnabled ?? false,
    source: 'agent',
    threadId: input.threadId,
    referenceImageUrls: input.referenceImageUrls,
    certificateMaxRecipients: input.agentId ? 50 : undefined,
  });
}

// ── Tool ID resolution ─────────────────────────────────────────────────────────

export function resolveRunToolIds(input: {
  baseToolIds?: string[] | null;
  fallbackToolIds?: string[] | null;
  skillToolIds: string[];
}): string[] | null {
  const baseToolIds = input.baseToolIds !== undefined
    ? input.baseToolIds
    : (input.fallbackToolIds ?? null);
  if (input.skillToolIds.length === 0) return baseToolIds;
  if (baseToolIds === null) return null;
  return [...new Set([...baseToolIds, ...input.skillToolIds])];
}

// ── Full run tool assembly (adds user-created tools + MCP on top) ──────────────

export async function buildPreparedRunTools(input: {
  supportsTools: boolean;
  toolsOverride?: ToolSet;
  toolAdapter?: RunToolAdapter;
  resolvedAgent: RunToolsAgent | null;
  activeToolIds: string[] | null;
  billingUserId: string;
  effectiveDocumentIds?: string[];
  activeBrandId?: string;
  rerankEnabled?: boolean;
  threadId: string;
  referenceImageUrls?: string[];
  allowMcp: boolean;
  channel: 'web' | 'shared_link' | 'line';
  mcpCredentials?: Record<string, string>;
}): Promise<ToolSet | undefined> {
  if (!input.supportsTools) return undefined;

  if (input.toolAdapter) {
    return input.toolAdapter({
      enabledToolIds: input.activeToolIds,
      userId: input.billingUserId,
      agentId: input.resolvedAgent?.id ?? null,
      brandId: input.activeBrandId,
      documentIds: input.effectiveDocumentIds,
      rerankEnabled: input.rerankEnabled,
      threadId: input.threadId,
      referenceImageUrls: input.referenceImageUrls,
    });
  }

  const builtInTools = input.toolsOverride ?? buildToolsForRun({
    enabledToolIds: input.activeToolIds,
    userId: input.billingUserId,
    agentId: input.resolvedAgent?.id ?? null,
    brandId: input.activeBrandId,
    documentIds: input.effectiveDocumentIds,
    rerankEnabled: input.rerankEnabled,
    threadId: input.threadId,
    referenceImageUrls: input.referenceImageUrls,
  });

  const customTools = input.toolsOverride || !input.resolvedAgent
    ? {}
    : await import('@/features/user-tools/service').then(({ buildUserCreatedToolSet }) =>
        buildUserCreatedToolSet({
          userId: input.billingUserId,
          agentId: input.resolvedAgent!.id,
          source: input.channel === 'line' ? 'line' : 'agent',
          threadId: input.threadId,
        }),
      );

  let tools: ToolSet = { ...builtInTools, ...customTools };

  if (!input.toolsOverride && input.allowMcp && input.resolvedAgent?.mcpServers?.length) {
    const { buildMCPToolSet } = await import('@/lib/tools/mcp');
    const mcpTools = await buildMCPToolSet(
      input.resolvedAgent.mcpServers,
      input.mcpCredentials ?? {},
    ).catch((error: unknown) => {
      console.error('[MCP] Tool build failed:', error);
      return {};
    });
    tools = { ...tools, ...mcpTools };
  }

  return tools;
}
