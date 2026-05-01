import type { ResponsePlan } from '@/features/response-format/types';

export type ResponseAuditSummary = {
  responseIntent: ResponsePlan['intent'];
  responseFormats: ResponsePlan['formats'];
  templateKey: string | null;
  quickReplyCount: number;
  escalationCreated: boolean;
  workflowType: ResponsePlan['workflow'] extends infer T
    ? T extends { type: infer U }
      ? U | null
      : null
    : null;
  renderFallbackUsed: boolean;
  parseConfidence: number | null;
};

export function buildResponseAuditSummary(
  plan: ResponsePlan,
  options: {
    renderFallbackUsed?: boolean;
    parseConfidence?: number | null;
  } = {},
): ResponseAuditSummary {
  return {
    responseIntent: plan.intent,
    responseFormats: plan.formats,
    templateKey: plan.card?.templateKey ?? null,
    quickReplyCount: plan.quickReplies?.length ?? 0,
    escalationCreated: Boolean(plan.workflow),
    workflowType: plan.workflow?.type ?? null,
    renderFallbackUsed: options.renderFallbackUsed ?? false,
    parseConfidence: options.parseConfidence ?? null,
  };
}
