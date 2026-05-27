import { buildAssistantResponseArtifacts } from '@/features/chat/server/finalization-helpers';
import type { ChatMessage, ChatMessageMetadata, VoiceTurnMetadata } from '@/features/chat/types';
import { buildTaskFlowMessageState } from '@/features/task-flows/service';
import type { TaskFlowDecision } from '@/features/task-flows/types';

type VoiceTurnAssistantArtifactsInput = {
  aiText: string;
  userText: string;
  metadata?: VoiceTurnMetadata;
  taskFlowDecision?: TaskFlowDecision;
};

export async function buildVoiceTurnAssistantArtifacts({
  aiText,
  userText,
  metadata,
  taskFlowDecision,
}: VoiceTurnAssistantArtifactsInput): Promise<{
  parts: ChatMessage['parts'];
  metadata: ChatMessageMetadata;
}> {
  const assistantMetadata: ChatMessageMetadata = {
    source: 'voice',
    ...(metadata ? { voice: metadata } : {}),
    ...(taskFlowDecision?.status === 'ready' || taskFlowDecision?.status === 'needs_more_info'
      ? { taskFlow: buildTaskFlowMessageState(taskFlowDecision) }
      : {}),
  };
  const toolResults = (metadata?.toolCalls ?? [])
    .filter((toolCall) => toolCall.ok && toolCall.output !== undefined)
    .map((toolCall) => ({
      toolName: toolCall.name,
      output: toolCall.output,
    }));
  const artifacts = await buildAssistantResponseArtifacts({
    assistantText: aiText,
    lastUserPrompt: userText,
    toolResults,
    taskFlowDecision: taskFlowDecision?.status === 'ready' ? taskFlowDecision : null,
    source: 'finalization',
  });
  const parts: ChatMessage['parts'] = [{ type: 'text', text: aiText }];

  if (artifacts.richMessagePart) {
    parts.push(artifacts.richMessagePart as ChatMessage['parts'][number]);
  }

  return {
    parts,
    metadata: {
      ...assistantMetadata,
      ...(artifacts.responseAudit ? { responseFormat: artifacts.responseAudit } : {}),
    },
  };
}
