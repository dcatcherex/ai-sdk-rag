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
const DEFAULT_REALTIME_REASONING_EFFORT = 'low';
export const WAIT_FOR_USER_TOOL_NAME = 'wait_for_user';

const REALTIME_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);

const WAIT_FOR_USER_TOOL: RealtimeFunctionTool = {
  type: 'function',
  name: WAIT_FOR_USER_TOOL_NAME,
  description: [
    'Call this when the latest audio does not need a spoken response, such as silence, background noise, hold music, TV audio, side conversation, or speech not addressed to the assistant.',
    'This tool ends the turn without a spoken reply.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

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

export function resolveOpenAIRealtimeReasoningEffort() {
  const configured = process.env.OPENAI_REALTIME_REASONING_EFFORT?.trim().toLowerCase();
  if (configured && REALTIME_REASONING_EFFORTS.has(configured)) {
    return configured;
  }

  return DEFAULT_REALTIME_REASONING_EFFORT;
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

function getSchemaPropertyNames(schema: Record<string, unknown>): string[] {
  const properties = schema.properties;
  if (!properties || typeof properties !== 'object') {
    return [];
  }

  return Object.keys(properties);
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function includesExactIdentifierTerm(value: string) {
  return /(^|[\s_-])id($|[\s_-])/.test(value) || includesAny(value, [
    'account',
    'claim',
    'code',
    'confirmation',
    'email',
    'identifier',
    'order',
    'phone',
    'ticket',
    'tracking',
  ]);
}

function buildRealtimeToolDescription(input: {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}) {
  const baseDescription = input.description?.trim() || `Run ${input.name}.`;
  const haystack = [
    input.name,
    baseDescription,
    ...getSchemaPropertyNames(input.parameters),
  ].join(' ').toLowerCase();
  const looksWriteAction = includesAny(haystack, [
    'add',
    'append',
    'cancel',
    'charge',
    'confirm',
    'create',
    'delete',
    'export',
    'generate',
    'log',
    'order',
    'publish',
    'remove',
    'save',
    'send',
    'submit',
    'transfer',
    'update',
    'upload',
  ]);
  const looksCommunicationAction = includesAny(haystack, [
    'broadcast',
    'email',
    'line',
    'message',
    'notification',
    'sms',
    'webhook',
  ]);
  const hasExactIdentifier = includesExactIdentifierTerm(haystack);

  const policyLines = [
    'Voice behavior:',
    '- Use only when the user intent is clear and the required fields are available.',
    '- Ask one short clarification question if a required field is missing, ambiguous, or conflicting.',
  ];

  if (hasExactIdentifier) {
    policyLines.push('- For exact identifiers such as IDs, phone numbers, email addresses, order numbers, or codes, confirm the normalized value before calling.');
  }

  if (looksWriteAction || looksCommunicationAction) {
    policyLines.push('- Before calling for write actions, external communications, publishing, cancellations, purchases, payments, or user-visible changes, summarize the consequence and ask for confirmation.');
  } else {
    policyLines.push('- For low-risk read-only lookups, call proactively after a brief preamble when the needed details are clear.');
  }

  policyLines.push(
    'Failure handling:',
    '- If the tool fails, explain the failure briefly, avoid raw errors, and give one clear next step.',
  );

  return `${baseDescription}\n\n${policyLines.join('\n')}`;
}

export function buildRealtimeVoiceInstructions() {
  return `# Realtime Voice Behavior

## Objective

You are speaking as the selected Vaja agent. Use the agent instructions, active skills, memory, brand context, and available tools to help the user by voice.

## Language

- Respond in Thai when the user clearly speaks Thai.
- Respond in English when the user clearly speaks English.
- Do not switch language based on accent alone.
- Ignore short filler sounds, backchannels, names, addresses, and isolated foreign words for language switching.
- If language is unclear, ask one short clarification.
- Keep preambles, tool updates, and final answers in the same language as the user.

## Verbosity

- Direct answers: use 1-2 short sentences.
- Clarifying questions: ask one question at a time.
- Tool results: summarize the result first, then give only the next useful action.
- Troubleshooting: give one step at a time unless the user asks for the full procedure.
- Escalation: briefly explain why escalation is needed and what will happen next.

## Preambles

Use a short preamble only when it helps the user understand that work is happening.
Use a preamble before slower tool calls, multi-step reasoning, record checks, policy checks, or escalation preparation.
Do not use a preamble for direct answers, simple confirmations, unclear audio, silence, background noise, or lightweight tool calls.
When using a preamble, use one short natural sentence. Describe the action, not private reasoning.

## Tools

Use only the tools explicitly provided in the current tool list. Do not invent, rename, simulate, or assume tools.

For read-only tools:
- Call the tool when the user's intent is clear and all required fields are available.
- Do not ask for confirmation unless the lookup depends on a high-precision identifier or there is meaningful risk of using the wrong record.
- Ask a clarification question only if a required field is missing, ambiguous, or conflicting.

For write tools or external actions:
- Summarize the intended action before calling the tool.
- Include the key consequence: what will be changed, sent, canceled, ordered, charged, saved, or published.
- Ask for confirmation.
- Do not call the tool until the user clearly confirms.

After tool calls:
- Only say an action was completed after the tool succeeds.
- If the tool fails, explain the failure briefly, avoid raw errors, and give one clear next step.
- Do not repeatedly call the same tool with the same arguments after failure.

## Unclear Audio

- Only act on clear audio or text.
- If the user's audio is unclear, noisy, silent, partially cut off, or ambiguous, ask one short clarification.
- Do not guess missing words.
- Do not call tools from unclear audio.
- Do not use a preamble when asking for unclear-audio clarification.

## Exact Entity Capture

Treat order IDs, tracking numbers, account numbers, confirmation codes, phone numbers, email addresses, ticket IDs, claim IDs, and similar values as high precision.

- Collect one exact value at a time.
- Normalize only what is clear.
- Preserve explicitly spoken separators like dash, dot, underscore, slash, and plus.
- Confirm the final normalized value before account-specific lookups, validation, write actions, or external actions.
- Read numeric identifiers back digit by digit.
- Ask users to spell email addresses character by character when precision matters.
- If the user corrects any part of the value, repeat the full corrected value and ask for confirmation again.

Never call tools with guessed, partial, ambiguous, or unconfirmed exact values.

## Silence and Background Audio

If the latest audio is silence, background noise, hold music, TV audio, side conversation, or speech not addressed to you, call wait_for_user if it is available.
Do not say "I'm here," "I didn't catch that," "Take your time," or "Let me know when you're ready" after calling wait_for_user.
Resume normal responses only when the user clearly addresses you or asks for help.`;
}

export async function buildRealtimeFunctionTools(tools?: ToolSet): Promise<RealtimeFunctionTool[]> {
  const entries = Object.entries(tools ?? {}).filter(([, tool]) => typeof tool.execute === 'function');

  const realtimeTools = await Promise.all(entries.map(async ([name, tool]) => {
    const schema = await asSchema(tool.inputSchema).jsonSchema;
    const parameters = ensureObjectJsonSchema(schema);

    return {
      type: 'function' as const,
      name,
      description: buildRealtimeToolDescription({
        name,
        description: tool.description,
        parameters,
      }),
      parameters,
    };
  }));

  if (realtimeTools.some((tool) => tool.name === WAIT_FOR_USER_TOOL_NAME)) {
    return realtimeTools;
  }

  return [...realtimeTools, WAIT_FOR_USER_TOOL];
}

export async function executeRealtimeToolCall(input: {
  userId: string;
  context: RealtimeVoiceContextInput;
  toolName: string;
  callId: string;
  argumentsJson: string;
  signal?: AbortSignal;
}) {
  if (input.toolName === WAIT_FOR_USER_TOOL_NAME) {
    await assertOwnedThread({ threadId: input.context.threadId, userId: input.userId });
    return { ok: true };
  }

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
