import type {
  ResponseChannel,
  ResponseIntent,
  ResponsePlan,
  ResponseQuickReply,
  ResponseSafety,
  ResponseWorkflow,
  ResponseWorkflowCapability,
  ResponseWorkflowScopeType,
} from '@/features/response-format/types';

export type ResponseWorkflowContext = {
  actorCapabilities?: ResponseWorkflowCapability[];
  scopeType?: ResponseWorkflowScopeType;
  scopeId?: string | null;
  subject?: string;
  sourceThreadId?: string;
  sourceMessageId?: string;
  channel?: ResponseChannel;
  locale?: string;
};

type HumanReviewWorkflowInput = {
  intent: ResponseIntent;
  locale: string;
  bodyText: string;
  safety?: ResponseSafety;
  context?: ResponseWorkflowContext;
};

export function maybeBuildHumanReviewWorkflow(
  input: HumanReviewWorkflowInput,
): ResponseWorkflow | undefined {
  const shouldEscalate =
    input.intent === 'escalation'
    || input.safety?.requiresEscalation
    || isHighSeverity(input.safety?.severity);

  if (!shouldEscalate) return undefined;

  const visibility = resolveWorkflowVisibility(input.context?.actorCapabilities ?? []);
  const priority = isHighSeverity(input.safety?.severity) ? 'urgent' : 'normal';
  const reason = buildHumanReviewReason(input.locale, input.safety, input.bodyText);

  return {
    type: 'human_review',
    priority,
    reason,
    assigneeRole: 'reviewer',
    status: visibility.canRequest ? 'suggested' : 'restricted',
    subject: input.context?.subject ?? defaultWorkflowSubject(input.intent, input.locale),
    ...(input.context?.scopeType ? { scopeType: input.context.scopeType } : {}),
    ...(input.context?.scopeId ? { scopeId: input.context.scopeId } : {}),
    ...(input.context?.sourceThreadId ? { sourceThreadId: input.context.sourceThreadId } : {}),
    ...(input.context?.sourceMessageId ? { sourceMessageId: input.context.sourceMessageId } : {}),
    requiredCapabilities: ['workflow.request_human_review', 'conversation.read_escalated'],
    visibility,
    data: {
      safety: input.safety ?? null,
      reviewChannel: input.context?.channel ?? null,
    },
  };
}

export function buildWorkflowQuickReplies(
  workflow: ResponseWorkflow | undefined,
  locale: string,
): ResponseQuickReply[] {
  if (!workflow?.visibility?.canRequest) return [];

  if (workflow.type === 'human_review') {
    return [{
      actionType: 'postback',
      label: locale.startsWith('th') ? 'ขอคนช่วย' : 'Ask human',
      text: locale.startsWith('th') ? 'ขอเจ้าหน้าที่ช่วยดู' : 'Request human review',
      postbackData: buildWorkflowPostbackData(workflow),
    }];
  }

  return [];
}

export function mergeResponseQuickReplies(
  primary: ResponseQuickReply[] = [],
  secondary: ResponseQuickReply[] = [],
  maxItems = 4,
): ResponseQuickReply[] {
  const seen = new Set<string>();
  const merged: ResponseQuickReply[] = [];

  for (const reply of [...primary, ...secondary]) {
    const key = `${reply.actionType}|${reply.label}|${reply.text ?? ''}|${reply.postbackData ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(reply);
    if (merged.length >= maxItems) break;
  }

  return merged;
}

export function buildWorkflowPostbackData(workflow: ResponseWorkflow): string {
  const scopeType = workflow.scopeType ?? 'system';
  const scopeId = workflow.scopeId ?? 'unknown';
  return `workflow:human_review:request:${scopeType}:${scopeId}`;
}

function resolveWorkflowVisibility(
  capabilities: ResponseWorkflowCapability[],
): NonNullable<ResponseWorkflow['visibility']> {
  return {
    canRequest: capabilities.includes('workflow.request_human_review'),
    canAssign: capabilities.includes('workflow.assign_reviewer'),
    canViewQueue: capabilities.includes('workflow.view_review_queue'),
    canResolve: capabilities.includes('workflow.resolve'),
    canReadEscalated: capabilities.includes('conversation.read_escalated'),
  };
}

function buildHumanReviewReason(
  locale: string,
  safety: ResponseSafety | undefined,
  bodyText: string,
): string {
  if (safety?.notes?.length) {
    const noteText = safety.notes.join(', ');
    return locale.startsWith('th')
      ? `แนะนำให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม (${noteText})`
      : `Human review suggested (${noteText})`;
  }

  return locale.startsWith('th')
    ? `แนะนำให้เจ้าหน้าที่ตรวจสอบเพิ่มเติม: ${bodyText.slice(0, 120)}`
    : `Human review suggested: ${bodyText.slice(0, 120)}`;
}

function defaultWorkflowSubject(intent: ResponseIntent, locale: string): string {
  if (intent === 'escalation') {
    return locale.startsWith('th') ? 'เคสต้องการการส่งต่อ' : 'Escalated case';
  }

  return locale.startsWith('th') ? 'คำขอตรวจสอบโดยมนุษย์' : 'Human review request';
}

function isHighSeverity(
  severity: ResponseSafety['severity'] | undefined,
): severity is 'high' | 'critical' {
  return severity === 'high' || severity === 'critical';
}
