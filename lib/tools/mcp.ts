/**
 * MCP (Model Context Protocol) tool builder.
 *
 * Connects to MCP servers configured on an agent and converts their tools into
 * AI SDK tool() definitions that streamText can use.
 *
 * Tool names are prefixed with the server name to avoid collisions:
 *   server "doae" + tool "get_prices" → "doae__get_prices"
 *
 * All MCP tools default to needsApproval: true (external servers should not
 * auto-execute without user confirmation).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { McpServerConfig } from '@/features/agents/types';

// Use the widest compatible Tool type so dynamic schemas don't cause narrowing errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiTool = Tool<any, any>;

/**
 * Connect to one MCP server, list its tools, and return them as AI SDK tool()
 * definitions. Disconnects immediately after listing (stateless per-request).
 */
async function buildToolsForServer(
  server: McpServerConfig,
  credentials?: Record<string, string>,
): Promise<Record<string, AiTool>> {
  const headers: Record<string, string> = {};
  if (server.authType === 'bearer' && server.credentialKey) {
    const token = credentials?.[server.credentialKey];
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (server.authType === 'api_key' && server.credentialKey) {
    const key = credentials?.[server.credentialKey];
    if (key) headers['X-API-Key'] = key;
  }

  const client = new Client(
    { name: 'vaja-mcp-client', version: '1.0.0' },
    { capabilities: {} },
  );

  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers },
  });

  await client.connect(transport);

  let mcpTools: Awaited<ReturnType<typeof client.listTools>>['tools'];
  try {
    ({ tools: mcpTools } = await client.listTools());
  } finally {
    await client.close().catch(() => {/* ignore close errors */});
  }

  const aiSdkTools: Record<string, AiTool> = {};

  for (const mcpTool of mcpTools) {
    const toolId = `${server.name}__${mcpTool.name}`;

    // Build a Zod schema from the MCP inputSchema. Using z.any() per property
    // is intentionally loose — the AI still sees the JSON Schema description
    // and knows what arguments to pass. Use json-schema-to-zod for stricter
    // validation in a future iteration.
    const properties = (mcpTool.inputSchema as { properties?: Record<string, unknown> } | undefined)?.properties;
    const required = (mcpTool.inputSchema as { required?: string[] } | undefined)?.required ?? [];

    const paramSchema = properties
      ? z.object(
          Object.fromEntries(
            Object.keys(properties).map((k) => [
              k,
              required.includes(k) ? z.any() : z.any().optional(),
            ]),
          ),
        )
      : z.object({});

    // Capture variables for the closure
    const serverRef = server;
    const toolName = mcpTool.name;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiSdkTools[toolId] = tool({
      description: `[${serverRef.name}] ${mcpTool.description ?? mcpTool.name}`,
      inputSchema: paramSchema,
      needsApproval: true, // MCP tools always require user approval
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (input: any) => {
        // Re-connect for execution (stateless per-call approach)
        const execClient = new Client(
          { name: 'vaja-mcp-client', version: '1.0.0' },
          { capabilities: {} },
        );
        const execTransport = new StreamableHTTPClientTransport(
          new URL(serverRef.url),
          { requestInit: { headers } },
        );
        await execClient.connect(execTransport);
        try {
          const result = await execClient.callTool({
            name: toolName,
            arguments: input as Record<string, unknown>,
          });
          // MCP returns a content array — flatten to a string for the AI
          return (result.content as Array<{ type: string; text?: string }>)
            .map((c) => (c.type === 'text' ? (c.text ?? '') : JSON.stringify(c)))
            .join('\n');
        } finally {
          await execClient.close().catch(() => {/* ignore */});
        }
      },
    });
  }

  return aiSdkTools;
}

/**
 * Build a combined tool set from all MCP servers configured on an agent.
 *
 * Failures are isolated per server — if one server is unreachable the others
 * still load. Returns an empty object when mcpServers is empty.
 */
export async function buildMCPToolSet(
  mcpServers: McpServerConfig[],
  credentials?: Record<string, string>,
): Promise<Record<string, AiTool>> {
  if (!mcpServers || mcpServers.length === 0) return {};

  const results = await Promise.allSettled(
    mcpServers.map((server) => buildToolsForServer(server, credentials)),
  );

  const merged: Record<string, AiTool> = {};
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value);
    } else {
      console.error(
        `[MCP] Server "${mcpServers[i]!.name}" failed to connect:`,
        result.reason,
      );
      // Degrade gracefully — don't break the chat request
    }
  }

  return merged;
}
