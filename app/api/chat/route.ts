import {
  streamText,
  generateImage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { headers } from 'next/headers';
import { and, eq, exists, or } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agent, agentShare, chatThread, customPersona, personaCustomization, user as userTable, userPreferences } from '@/db/schema';
import { VALID_PERSONA_KEYS } from '@/lib/persona-detection';
import { availableModels, maxSteps } from '@/lib/ai';
import { getSystemPrompt } from '@/lib/prompt';
import { detectPersona } from '@/lib/persona-detection';
import { enhancePrompt } from '@/lib/prompt-enhance';
import { summarizeConversation, SUMMARY_THRESHOLD } from '@/lib/conversation-summary';
import { getUserModelScores } from '@/lib/model-scores';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { buildToolSet } from '@/lib/tools';
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
    // ── Stage 1: auth + body parse in parallel ───────────────────────────────
    const [session, rawBody] = await Promise.all([
      headers().then((h) => auth.api.getSession({ headers: h })),
      req.json(),
    ]);
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, threadId, model, useWebSearch, selectedDocumentIds, enabledModelIds, agentId, personaId } =
      requestSchema.parse(rawBody);

    // Determine if personaId refers to a built-in key or a custom persona DB row
    const isBuiltinPersona = personaId ? (VALID_PERSONA_KEYS as string[]).includes(personaId) : false;
    const isCustomPersonaId = personaId && !isBuiltinPersona;

    // ── Stage 2: all independent DB queries in parallel ──────────────────────
    const [userRow, threadRows, prefsRows, balance, activeAgentRows, personaCustomRows, customPersonaRows] = await Promise.all([
      db
        .select({ approved: userTable.approved })
        .from(userTable)
        .where(eq(userTable.id, session.user.id))
        .limit(1),
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
      getUserBalance(session.user.id),
      agentId
        ? db
            .select()
            .from(agent)
            .where(
              and(
                eq(agent.id, agentId),
                or(
                  eq(agent.userId, session.user.id),
                  eq(agent.isPublic, true),
                  exists(
                    db
                      .select({ id: agentShare.agentId })
                      .from(agentShare)
                      .where(
                        and(
                          eq(agentShare.agentId, agentId),
                          eq(agentShare.sharedWithUserId, session.user.id),
                        ),
                      ),
                  ),
                ),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ personaKey: personaCustomization.personaKey, extraInstructions: personaCustomization.extraInstructions })
        .from(personaCustomization)
        .where(eq(personaCustomization.userId, session.user.id)),
      isCustomPersonaId
        ? db
            .select({ id: customPersona.id, name: customPersona.name, systemPrompt: customPersona.systemPrompt })
            .from(customPersona)
            .where(and(eq(customPersona.id, personaId!), eq(customPersona.userId, session.user.id)))
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (!userRow[0]?.approved) {
      return Response.json(
        { error: 'Your account is pending approval. Please contact the admin.' },
        { status: 403 }
      );
    }
    if (threadRows.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const currentTitle = threadRows[0]!.title ?? 'New chat';
    const userPrefs = prefsRows[0] ?? { memoryEnabled: true, memoryInjectEnabled: true, memoryExtractEnabled: true, personaDetectionEnabled: true, promptEnhancementEnabled: true, followUpSuggestionsEnabled: true, enabledToolIds: null };
    const activeAgent = activeAgentRows[0] ?? null;
    const personaCustomMap: Record<string, string> = {};
    for (const row of personaCustomRows) personaCustomMap[row.personaKey] = row.extraInstructions;
    const lastUserPrompt = getLastUserPrompt(messages);

    const customPersonaRow = customPersonaRows[0] ?? null;

    // ── Stage 3: memory + persona detection in parallel ─────────────────────
    const [memoryContext, detectedPersona] = await Promise.all([
      (userPrefs.memoryEnabled && userPrefs.memoryInjectEnabled)
        ? getUserMemoryContext(session.user.id)
        : Promise.resolve(''),
      // personaId overrides auto-detection: built-in key used directly, custom persona resolved above
      isBuiltinPersona
        ? Promise.resolve(personaId as SystemPromptKey)
        : isCustomPersonaId
          ? Promise.resolve('general_assistant' as SystemPromptKey) // placeholder; custom prompt used below
          : (userPrefs.personaDetectionEnabled ?? true) && lastUserPrompt
            ? detectPersona(lastUserPrompt)
            : Promise.resolve('general_assistant' as SystemPromptKey),
    ]);

    // Merge agent pre-associated docs + user-selected docs (union, deduplicated)
    const agentDocIds = activeAgent?.documentIds ?? [];
    const userDocIds = selectedDocumentIds ?? [];
    const effectiveDocIds =
      agentDocIds.length > 0 || userDocIds.length > 0
        ? [...new Set([...agentDocIds, ...userDocIds])]
        : undefined;

    const isGrounded = !!effectiveDocIds?.length;

    // Determine which tool group IDs are active for this request:
    //   1. Agent has its own explicit list (overrides everything)
    //   2. Otherwise use the user's saved preferences (null = all tools)
    const activeToolIds = activeAgent
      ? activeAgent.enabledTools
      : (userPrefs.enabledToolIds ?? null);

    const groundedTools = activeAgent
      ? createAgentTools(activeAgent.enabledTools, session.user.id, effectiveDocIds)
      : buildToolSet({
          enabledToolIds: activeToolIds,
          userId: session.user.id,
          documentIds: isGrounded ? effectiveDocIds : undefined,
        });

    const personaExtraInstructions = !activeAgent ? (personaCustomMap[detectedPersona] ?? '') : '';
    // Base system prompt: agent > custom persona > built-in persona
    const baseSystemPrompt = activeAgent
      ? activeAgent.systemPrompt
      : customPersonaRow
        ? customPersonaRow.systemPrompt
        : getSystemPrompt(detectedPersona);

    const groundedSystemPrompt = activeAgent
      ? activeAgent.systemPrompt +
        (isGrounded
          ? '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.'
          : '') +
        (memoryContext ? `\n\n${memoryContext}` : '')
      : isGrounded
        ? baseSystemPrompt +
          (personaExtraInstructions ? `\n\n<user_instructions>\n${personaExtraInstructions}\n</user_instructions>` : '') +
          '\nIMPORTANT: The user has selected specific documents. You MUST use the searchKnowledge tool to find information before answering. Only respond using information from tool results. If no relevant information is found, say so.' +
          (memoryContext ? `\n\n${memoryContext}` : '')
        : baseSystemPrompt +
          (personaExtraInstructions ? `\n\n<user_instructions>\n${personaExtraInstructions}\n</user_instructions>` : '') +
          (memoryContext ? `\n\n${memoryContext}` : '');

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
      : baseSystemPrompt + (memoryContext ? `\n\n${memoryContext}` : '');

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
      persona: customPersonaRow ? `custom:${customPersonaRow.name}` : detectedPersona,
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
        if (lastAssistantIdx !== -1 && (userPrefs.followUpSuggestionsEnabled ?? true)) {
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

        if (userPrefs.memoryEnabled && userPrefs.memoryExtractEnabled) {
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
