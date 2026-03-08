import {
  streamText,
  generateImage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, chatThread, user as userTable, userPreferences } from '@/db/schema';
import { availableModels, maxSteps } from '@/lib/ai';
import { getSystemPrompt, detectSystemPromptKey } from '@/lib/prompt';
import { enhancePrompt } from '@/lib/prompt-enhance';
import { summarizeConversation, SUMMARY_THRESHOLD } from '@/lib/conversation-summary';
import { getUserModelScores } from '@/lib/model-scores';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { baseTools } from '@/lib/tools';
import { createScopedRagTools } from '@/lib/rag-tool';
import { createAgentTools } from '@/lib/agent-tools';
import { getCreditCost, getUserBalance } from '@/lib/credits';
import { requestSchema } from '@/features/chat/server/schema';
import { getLastUserPrompt } from '@/features/chat/server/thread-utils';
import { toolDisabledModels, isImageOnlyModel, getModelByIntent } from '@/features/chat/server/routing';
import { persistChatResult } from '@/features/chat/server/persistence';
import type { ChatMessage, ChatMessageMetadata, RoutingMetadata } from '@/features/chat/types';
import type { SystemPromptKey } from '@/lib/prompt';

export { type ChatMessage };
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check approval status
    const userRow = await db
      .select({ approved: userTable.approved })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);
    if (!userRow[0]?.approved) {
      return Response.json(
        { error: 'Your account is pending approval. Please contact the admin.' },
        { status: 403 }
      );
    }

    const { messages, threadId, model, useWebSearch, selectedDocumentIds, enabledModelIds, agentId } =
      requestSchema.parse(await req.json());

    // ── Load thread + user prefs in parallel ────────────────────────────────
    const [threadRows, prefsRows] = await Promise.all([
      db
        .select({ id: chatThread.id, title: chatThread.title })
        .from(chatThread)
        .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
        .limit(1),
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, session.user.id))
        .limit(1),
    ]);

    if (threadRows.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const currentTitle = threadRows[0]!.title ?? 'New chat';
    const userPrefs = prefsRows[0] ?? { memoryEnabled: true, promptEnhancementEnabled: true };
    const lastUserPrompt = getLastUserPrompt(messages);

    // ── Load agent, memory ───────────────────────────────────────────────────
    const [activeAgentRows, memoryContext] = await Promise.all([
      agentId
        ? db
            .select()
            .from(agent)
            .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
            .limit(1)
        : Promise.resolve([]),
      userPrefs.memoryEnabled ? getUserMemoryContext(session.user.id) : Promise.resolve(''),
    ]);
    const activeAgent = activeAgentRows[0] ?? null;

    // ── Persona + system prompt + tools ─────────────────────────────────────
    const detectedPersona: SystemPromptKey = lastUserPrompt
      ? detectSystemPromptKey(lastUserPrompt)
      : 'general_assistant';

    const isGrounded = !!selectedDocumentIds?.length;
    const groundedTools = activeAgent
      ? createAgentTools(activeAgent.enabledTools, selectedDocumentIds)
      : isGrounded
        ? { ...baseTools, ...createScopedRagTools(selectedDocumentIds) }
        : baseTools;

    const groundedSystemPrompt = activeAgent
      ? activeAgent.systemPrompt + (memoryContext ? `\n\n${memoryContext}` : '')
      : isGrounded
        ? getSystemPrompt(detectedPersona) +
          '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.' +
          (memoryContext ? `\n\n${memoryContext}` : '')
        : getSystemPrompt(detectedPersona) + (memoryContext ? `\n\n${memoryContext}` : '');

    // ── Model routing ────────────────────────────────────────────────────────
    const enabledIds =
      enabledModelIds?.length
        ? enabledModelIds.filter((id) => availableModels.some((m) => m.id === id))
        : availableModels.map((m) => m.id);

    const agentSuggestedModel = activeAgent?.modelId ?? null;
    const manualModel = model && model !== 'auto' ? model : (agentSuggestedModel ?? null);
    const manualResolved = manualModel && enabledIds.includes(manualModel) ? manualModel : null;

    const userScores = manualResolved
      ? new Map<string, number>()
      : await getUserModelScores(session.user.id);

    const routingDecision = manualResolved
      ? { modelId: manualResolved, reason: 'Manual selection' }
      : getModelByIntent({
          prompt: lastUserPrompt,
          enabledModelIds: enabledIds.length > 0 ? enabledIds : [availableModels[0]!.id],
          useWebSearch,
          userScores,
        });

    const resolvedModel = routingDecision.modelId;
    const routingMetadata: RoutingMetadata = {
      mode: manualResolved ? 'manual' : 'auto',
      modelId: resolvedModel,
      reason: routingDecision.reason,
    };

    // ── Credit check ─────────────────────────────────────────────────────────
    const creditCost = getCreditCost(resolvedModel);
    const balance = await getUserBalance(session.user.id);
    if (balance < creditCost) {
      return Response.json(
        {
          error: `Insufficient credits. This model costs ${creditCost} credits, but you have ${balance}. Please contact admin for more credits.`,
        },
        { status: 402 }
      );
    }

    const supportsTools = !toolDisabledModels.has(resolvedModel);
    const activeTools = supportsTools ? groundedTools : undefined;
    const systemPrompt = supportsTools
      ? groundedSystemPrompt
      : getSystemPrompt(detectedPersona) + (memoryContext ? `\n\n${memoryContext}` : '');

    // ── Prompt enhancement ───────────────────────────────────────────────────
    let enhancedPrompt: string | undefined;
    let messagesToSend = messages;
    if (userPrefs.promptEnhancementEnabled && lastUserPrompt) {
      const enhanced = await enhancePrompt(lastUserPrompt, memoryContext);
      if (enhanced !== lastUserPrompt) {
        enhancedPrompt = enhanced;
        const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
        if (lastUserIdx !== -1) {
          messagesToSend = messages.map((m, i) =>
            i !== lastUserIdx
              ? m
              : { ...m, parts: m.parts.map((p) => (p.type === 'text' ? { ...p, text: enhanced } : p)) }
          );
        }
      }
    }

    // ── Conversation summarisation ───────────────────────────────────────────
    let conversationSummaryBlock = '';
    if (messages.length > SUMMARY_THRESHOLD) {
      const { summary, trimmedMessages } = await summarizeConversation(messagesToSend as ChatMessage[]);
      if (summary) {
        conversationSummaryBlock = `\n\n<conversation_summary>\nSummary of earlier conversation:\n${summary}\n</conversation_summary>`;
        messagesToSend = trimmedMessages;
      }
    }
    const effectiveSystemPrompt = systemPrompt + conversationSummaryBlock;

    const messageMetadata = (): ChatMessageMetadata => ({
      routing: routingMetadata,
      persona: detectedPersona,
      ...(enhancedPrompt ? { enhancedPrompt } : {}),
    });

    // ── Image generation path ────────────────────────────────────────────────
    if (isImageOnlyModel(resolvedModel)) {
      const imagePrompt = enhancedPrompt ?? lastUserPrompt;
      if (!imagePrompt) {
        return Response.json({ error: 'Image generation requires a text prompt.' }, { status: 400 });
      }

      const imageResult = await generateImage({ model: resolvedModel, prompt: imagePrompt });
      const generatedImage = imageResult.image;
      const imageDataUrl = `data:${generatedImage.mediaType};base64,${generatedImage.base64}`;

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        metadata: messageMetadata(),
        parts: [{ type: 'file', mediaType: generatedImage.mediaType, url: imageDataUrl, editPrompt: imagePrompt } as ChatMessage['parts'][number]],
      };

      await persistChatResult({
        updatedMessages: [...messages, assistantMessage],
        threadId,
        userId: session.user.id,
        currentTitle,
        resolvedModel,
        creditCost,
        tokenUsageData: {
          promptTokens: imageResult.usage.inputTokens,
          completionTokens: imageResult.usage.outputTokens,
          totalTokens: imageResult.usage.totalTokens,
        },
      });

      return createUIMessageStreamResponse({
        stream: createUIMessageStream<ChatMessage>({
          originalMessages: messages,
          execute: ({ writer }) => {
            writer.write({ type: 'start', messageMetadata: messageMetadata() });
            writer.write({ type: 'start-step' });
            writer.write({ type: 'file', mediaType: generatedImage.mediaType, url: imageDataUrl });
            writer.write({ type: 'finish-step' });
            writer.write({ type: 'finish', finishReason: 'stop' });
          },
        }),
      });
    }

    // ── Text streaming path ──────────────────────────────────────────────────
    // Strip compare assistant messages from LLM context
    const messagesForLLM = messagesToSend.filter((m) => {
      if (m.role !== 'assistant') return true;
      return !(m.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
    });

    const result = streamText({
      model: resolvedModel,
      system: effectiveSystemPrompt,
      messages: await convertToModelMessages(messagesForLLM),
      stopWhen: stepCountIs(maxSteps),
      ...(supportsTools ? { tools: activeTools } : {}),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      messageMetadata,
      onFinish: async ({ messages: updatedMessages }) => {
        const usage = (await result.usage) as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
        const typedMessages = updatedMessages as ChatMessage[];

        // Inject follow-up suggestions into last assistant message
        const lastAssistantIdx = typedMessages.map((m) => m.role).lastIndexOf('assistant');
        let messagesWithSuggestions = typedMessages;
        if (lastAssistantIdx !== -1) {
          const contextStr = typedMessages
            .slice(-6)
            .map((m) => {
              const textPart = m.parts.find((p) => p.type === 'text');
              const text = textPart?.type === 'text' ? textPart.text.slice(0, 400) : '';
              return `${m.role}: ${text}`;
            })
            .filter((line) => !line.endsWith(': '))
            .join('\n');

          const suggestions = await generateFollowUpSuggestions(contextStr);
          if (suggestions.length > 0) {
            messagesWithSuggestions = typedMessages.map((m, i) =>
              i === lastAssistantIdx
                ? { ...m, metadata: { ...m.metadata, followUpSuggestions: suggestions } }
                : m
            );
          }
        }

        await persistChatResult({
          updatedMessages: messagesWithSuggestions,
          threadId,
          userId: session.user.id,
          currentTitle,
          resolvedModel,
          creditCost,
          tokenUsageData: usage,
        });

        if (userPrefs.memoryEnabled) {
          void extractAndStoreMemory(
            session.user.id,
            messagesWithSuggestions as Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>,
            threadId,
            memoryContext
          );
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
