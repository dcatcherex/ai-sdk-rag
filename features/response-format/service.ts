import type {
  ResponseIntent,
  ResponsePlan,
  ResponseQuickReply,
  ResponseSafety,
  ResponseWorkflow,
} from '@/features/response-format/types';
import { buildResponsePlan, detectFallbackFormat } from '@/features/response-format/server/select';
import type { ResponseWorkflowContext } from '@/features/response-format/workflow';

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
