import 'server-only';

import { asSchema, type ToolSet } from 'ai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { chatThread } from '@/db/schema';
import { getUserPrefs } from '@/features/chat/server/queries';
import { getAgentForUser } from '@/features/agents/server/queries';
import { resolveWebActiveAgent } from '@/features/chat/server/web-active-agent';
import { prepareAgentRun, type PreparedAgentRun } from '@/features/agents/server/run-service';
import { WEB_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import { buildWebChannelContext } from '@/features/chat/server/web-channel-context';
import { getUserMemoryContext } from '@/lib/memory';
import { buildThreadWorkingMemoryPromptBlock } from '@/features/memory/server/working-memory';
import { buildBrandMemoryPromptBlock } from '@/features/memory/server/brand-memory';
import { resolveAgentBrandRuntime } from '@/features/agents/server/runtime';
import { getSkillsForAgent, resolveRealtimeVoiceSkillRuntimeContext } from '@/features/skills/service';
import type { AgentRunInputMessage } from '@/features/agents/server/run-types';
import type { Agent } from '@/features/agents/types';

const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2';
const DEFAULT_REALTIME_VOICE = 'marin';

export const realtimeVoiceHistorySchema = z.array(z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
})).optional();

export const realtimeVoiceContextSchema = z.object({
  threadId: z.string().min(1),
  agentId: z.string().min(1).nullable().optional(),
  model: z.string().optional(),
  enabledModelIds: z.array(z.string()).optional(),
  selectedDocumentIds: z.array(z.string()).optional(),
  useWebSearch: z.boolean().optional(),
  voiceName: z.string().nullable().optional(),
  history: realtimeVoiceHistorySchema,
});

export type RealtimeVoiceContextInput = z.infer<typeof realtimeVoiceContextSchema>;

export type RealtimeFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export function resolveOpenAIRealtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
}

export function resolveOpenAIRealtimeVoice(voiceName?: string | null) {
  const configured = process.env.OPENAI_REALTIME_VOICE?.trim();
  if (configured) return configured;

  const normalized = voiceName?.trim().toLowerCase();
  if (!normalized) return DEFAULT_REALTIME_VOICE;

  const allowedVoices = new Set(['marin', 'cedar']);
  return allowedVoices.has(normalized) ? normalized : DEFAULT_REALTIME_VOICE;
}

export async function assertOwnedThread(input: {
  threadId: string;
  userId: string;
}) {
  const [thread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.id, input.threadId), eq(chatThread.userId, input.userId)))
    .limit(1);

  if (!thread) {
    throw new Error('Thread not found');
  }
}

function buildVoiceRunMessages(history?: Array<{ role: 'user' | 'assistant'; text: string }>): AgentRunInputMessage[] {
  const turns = (history ?? [])
    .slice(-12)
    .filter((turn) => turn.text.trim())
    .map((turn) => ({
      role: turn.role,
      content: turn.text.trim(),
      parts: [{ type: 'text', text: turn.text.trim() }],
    }));

  if (turns.some((turn) => turn.role === 'user')) {
    return turns;
  }

  return [
    ...turns,
    {
      role: 'user',
      content: 'Start a realtime voice conversation.',
      parts: [{ type: 'text', text: 'Start a realtime voice conversation.' }],
    },
  ];
}

async function resolveActiveAgent(input: {
  userId: string;
  agentId?: string | null;
}): Promise<Agent | null> {
  const activeAgentRow = input.agentId
    ? await getAgentForUser(input.agentId, input.userId)
    : null;
  const resolved = await resolveWebActiveAgent({
    isGuest: false,
    requestedAgentId: input.agentId ?? null,
    effectiveUserId: input.userId,
    activeAgentRow,
  });

  if (resolved.requiresConfiguredStarterTemplate) {
    throw new Error('A starter template must be configured before first-time users can chat.');
  }

  return resolved.activeAgent;
}

export async function prepareRealtimeVoiceRun(input: {
  userId: string;
  context: RealtimeVoiceContextInput;
}): Promise<PreparedAgentRun> {
  await assertOwnedThread({ threadId: input.context.threadId, userId: input.userId });

  const [prefs, activeAgent] = await Promise.all([
    getUserPrefs(input.userId),
    resolveActiveAgent({ userId: input.userId, agentId: input.context.agentId }),
  ]);
  const userPrefs = prefs ?? {
    memoryEnabled: true,
    memoryInjectEnabled: true,
    enabledToolIds: null,
    rerankEnabled: false,
    mcpCredentials: {},
  };
  const baseToolIds = activeAgent
    ? activeAgent.enabledTools
    : (userPrefs.enabledToolIds ?? null);

  const [memoryContext, threadWorkingMemoryBlock, brandRuntime, skills] = await Promise.all([
    userPrefs.memoryEnabled && userPrefs.memoryInjectEnabled
      ? getUserMemoryContext(input.userId)
      : Promise.resolve(''),
    buildThreadWorkingMemoryPromptBlock(input.context.threadId),
    resolveAgentBrandRuntime({
      userId: input.userId,
      activeBrandId: null,
      agent: activeAgent,
      enabled: true,
    }),
    activeAgent?.id ? getSkillsForAgent(activeAgent.id) : Promise.resolve([]),
  ]);

  if (brandRuntime.brandResolution?.shouldBlock) {
    throw new Error(brandRuntime.brandResolution.blockMessage ?? 'This agent requires a valid brand before it can run.');
  }

  const [skillRuntime, sharedMemoryBlock] = await Promise.all([
    resolveRealtimeVoiceSkillRuntimeContext(skills),
    buildBrandMemoryPromptBlock(input.userId, brandRuntime.activeBrand?.id ?? null, ''),
  ]);

  const channelContext = buildWebChannelContext({
    memoryContext,
    sharedMemoryBlock,
    threadWorkingMemoryBlock,
    conversationSummaryBlock: '',
    quizContextBlock: '',
    imageBlocks: ['', '', ''],
    rerankEnabled: userPrefs.rerankEnabled ?? false,
    referenceImageUrls: [],
    mcpCredentials: (userPrefs as { mcpCredentials?: Record<string, string> }).mcpCredentials ?? {},
    baseToolIds,
    activeAgent,
    userScores: new Map(),
    skillRuntime,
  });

  return prepareAgentRun({
    identity: {
      channel: 'web',
      userId: input.userId,
      billingUserId: input.userId,
    },
    threadId: input.context.threadId,
    agentId: activeAgent?.id ?? null,
    activeBrandId: brandRuntime.activeBrand?.id ?? null,
    selectedDocumentIds: input.context.selectedDocumentIds,
    messages: buildVoiceRunMessages(input.context.history),
    model: input.context.model ?? null,
    enabledModelIds: input.context.enabledModelIds,
    useWebSearch: input.context.useWebSearch,
    policy: WEB_AGENT_RUN_POLICY,
    channelContext,
  });
}

function ensureObjectJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: false };
  }

  const jsonSchema = schema as Record<string, unknown>;
  return {
    type: 'object',
    properties: {},
    ...jsonSchema,
  };
}

export async function buildRealtimeFunctionTools(tools?: ToolSet): Promise<RealtimeFunctionTool[]> {
  const entries = Object.entries(tools ?? {}).filter(([, tool]) => typeof tool.execute === 'function');

  return Promise.all(entries.map(async ([name, tool]) => {
    const schema = await asSchema(tool.inputSchema).jsonSchema;

    return {
      type: 'function' as const,
      name,
      description: tool.description ?? `Run ${name}.`,
      parameters: ensureObjectJsonSchema(schema),
    };
  }));
}

export async function executeRealtimeToolCall(input: {
  userId: string;
  context: RealtimeVoiceContextInput;
  toolName: string;
  callId: string;
  argumentsJson: string;
  signal?: AbortSignal;
}) {
  const preparedRun = await prepareRealtimeVoiceRun({
    userId: input.userId,
    context: input.context,
  });
  const tool = preparedRun.tools?.[input.toolName];

  if (!tool || typeof tool.execute !== 'function') {
    throw new Error(`Tool not available: ${input.toolName}`);
  }

  const parsedArguments = input.argumentsJson.trim()
    ? JSON.parse(input.argumentsJson)
    : {};
  const result = await tool.execute(parsedArguments, {
    toolCallId: input.callId,
    messages: [],
    abortSignal: input.signal,
    experimental_context: {
      userId: input.userId,
      threadId: input.context.threadId,
      source: 'realtime_voice',
    },
  });

  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let finalOutput: unknown;
    for await (const chunk of result as AsyncIterable<unknown>) {
      finalOutput = chunk;
    }
    return finalOutput;
  }

  return result;
}
