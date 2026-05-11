import type {
  ResponseIntent,
  ResponsePlan,
  ResponseQuickReply,
  ResponseSafety,
  ResponseWorkflow,
} from '@/features/response-format/types';
import { buildResponsePlan, detectFallbackFormat } from '@/features/response-format/server/select';
import type { ResponseWorkflowContext } from '@/features/response-format/workflow';
import { buildResponseCardFromTaskFlow } from '@/features/task-flows/response-format';
import type { TaskFlowDecision } from '@/features/task-flows/types';

type BuildFallbackResponsePlanInput = {
  text: string;
  userText?: string;
  locale?: string;
  intent?: ResponseIntent;
  quickReplies?: ResponseQuickReply[];
  safety?: ResponseSafety;
  workflow?: ResponseWorkflow;
  workflowContext?: ResponseWorkflowContext;
  metadata?: Record<string, unknown>;
};

export function buildFallbackResponsePlan({
  text,
  userText,
  locale = 'th-TH',
  intent = 'answer',
  quickReplies = [],
  safety,
  workflow,
  workflowContext,
  metadata,
}: BuildFallbackResponsePlanInput): ResponsePlan {
  return buildResponsePlan({
    text,
    userText,
    locale,
    intent,
    quickReplies,
    safety,
    workflow,
    workflowContext,
    metadata,
  });
}

export function buildResponsePlanFromTaskFlow(input: {
  assistantText: string;
  userText?: string;
  locale?: string;
  quickReplies?: ResponseQuickReply[];
  taskFlowDecision: Extract<TaskFlowDecision, { status: 'ready' }>;
  metadata?: Record<string, unknown>;
}): ResponsePlan {
  const card = buildResponseCardFromTaskFlow({
    decision: input.taskFlowDecision,
    assistantText: input.assistantText,
    locale: input.locale ?? 'th-TH',
  });

  return buildResponsePlan({
    text: input.assistantText,
    userText: input.userText,
    locale: input.locale ?? 'th-TH',
    intent: inferResponseIntentFromTaskFlow(input.taskFlowDecision),
    ...(card ? { card } : {}),
    quickReplies: input.quickReplies ?? [],
    metadata: {
      taskFlow: {
        flowKey: input.taskFlowDecision.flowKey,
        source: input.taskFlowDecision.source,
        confidence: input.taskFlowDecision.confidence,
      },
      ...(input.metadata ?? {}),
    },
  });
}

function inferResponseIntentFromTaskFlow(
  decision: Extract<TaskFlowDecision, { status: 'ready' }>,
): ResponseIntent {
  switch (decision.flowKey) {
    case 'agriculture.diagnosis':
      return 'diagnosis';
    case 'education.lesson_plan':
      return 'lesson_plan';
    default:
      return inferResponseIntentFromCard(decision.outputTemplateKey);
  }
}

function inferResponseIntentFromCard(templateKey?: string): ResponseIntent {
  if (!templateKey) {
    return 'answer';
  }

  const templateIntentMap: Record<string, ResponseIntent> = {
    'agriculture.diagnosis': 'diagnosis',
    'common.summary': 'answer',
  };

  return templateIntentMap[templateKey] ?? 'answer';
}
