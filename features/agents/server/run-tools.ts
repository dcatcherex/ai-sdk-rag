import type { ToolSet } from 'ai';

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

export async function buildPreparedRunTools(input: {
  supportsTools: boolean;
  toolsOverride?: ToolSet;
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

  const [{ buildToolSet }, { createAgentTools }, { buildUserCreatedToolSet }, { buildMCPToolSet }] = await Promise.all([
    import('@/lib/tools'),
    import('@/lib/agent-tools'),
    import('@/features/user-tools/service'),
    import('@/lib/tools/mcp'),
  ]);

  const builtInTools = input.toolsOverride
    ?? (
      input.resolvedAgent
        ? createAgentTools(
            input.activeToolIds,
            input.billingUserId,
            input.effectiveDocumentIds,
            {
              threadId: input.threadId,
              referenceImageUrls: input.referenceImageUrls,
              brandId: input.activeBrandId,
            },
          )
        : buildToolSet({
            enabledToolIds: input.activeToolIds,
            userId: input.billingUserId,
            brandId: input.activeBrandId,
            documentIds: input.effectiveDocumentIds,
            rerankEnabled: input.rerankEnabled ?? false,
            source: 'agent',
            threadId: input.threadId,
            referenceImageUrls: input.referenceImageUrls,
          })
    );

  const customTools = input.toolsOverride || !input.resolvedAgent
    ? {}
    : await buildUserCreatedToolSet({
        userId: input.billingUserId,
        agentId: input.resolvedAgent.id,
        source: input.channel === 'line' ? 'line' : 'agent',
        threadId: input.threadId,
      });

  let tools: ToolSet = { ...builtInTools, ...customTools };

  if (!input.toolsOverride && input.allowMcp && input.resolvedAgent?.mcpServers?.length) {
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
