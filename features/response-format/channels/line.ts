import type { LineMessage, QuickReply, QuickReplyItem, Sender } from '@/features/line-oa/webhook/types';
import { buildReplyMessages } from '@/features/line-oa/webhook/flex';
import { stripMarkdown } from '@/features/line-oa/webhook/utils/markdown';
import { QUICK_REPLY_LABEL_MAX } from '@/features/line-oa/webhook/types';
import type { ResponsePlan, ResponseQuickReply } from '@/features/response-format/types';
import { canRenderResponseTemplate, getResponseTemplateByKey } from '@/features/response-format/template-registry';

type RenderResponseForLineOptions = {
  sender?: Sender;
};

function truncateQuickReplyLabel(label: string): string {
  return label.length > QUICK_REPLY_LABEL_MAX
    ? `${label.slice(0, QUICK_REPLY_LABEL_MAX - 3)}...`
    : label;
}

function buildLineQuickReplyItem(reply: ResponseQuickReply): QuickReplyItem | null {
  const label = truncateQuickReplyLabel(reply.label.trim());
  if (!label) return null;

  switch (reply.actionType) {
    case 'message':
      return {
        type: 'action',
        action: {
          type: 'message',
          label,
          text: reply.text?.trim() || reply.label,
        },
      } as QuickReplyItem;
    case 'postback':
      if (!reply.postbackData?.trim()) return null;
      return {
        type: 'action',
        action: {
          type: 'postback',
          label,
          data: reply.postbackData,
          ...(reply.text?.trim() ? { displayText: reply.text.trim() } : {}),
        },
      } as QuickReplyItem;
    case 'camera':
      return { type: 'action', action: { type: 'camera', label } } as QuickReplyItem;
    case 'camera_roll':
      return { type: 'action', action: { type: 'cameraRoll', label } } as QuickReplyItem;
    case 'location':
      return { type: 'action', action: { type: 'location', label } } as QuickReplyItem;
    case 'datetime':
      return {
        type: 'action',
        action: {
          type: 'datetimepicker',
          label,
          data: reply.postbackData?.trim() || `response_format:datetime:${label}`,
          mode: 'datetime',
        },
      } as QuickReplyItem;
    default:
      return null;
  }
}

function buildLineQuickReply(replyPlan: ResponsePlan): QuickReply | undefined {
  const items = (replyPlan.quickReplies ?? [])
    .map(buildLineQuickReplyItem)
    .filter((item): item is QuickReplyItem => item !== null)
    .slice(0, 13);

  return items.length > 0 ? { items } : undefined;
}

function resolveLineBodyText(plan: ResponsePlan): string {
  if (plan.card?.fallbackText?.trim()) {
    return plan.card.fallbackText;
  }

  if (plan.bodyText.trim()) {
    return plan.bodyText;
  }

  const sectionText = (plan.sections ?? [])
    .map((section) => `${section.label}: ${section.value}`)
    .join('\n');

  return sectionText || plan.summary || plan.title || '';
}

function attachLineMeta(
  message: LineMessage,
  sender: Sender | undefined,
  quickReply: QuickReply | undefined,
): LineMessage {
  return {
    ...message,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}

export function renderResponseForLine(
  plan: ResponsePlan,
  options: RenderResponseForLineOptions = {},
): LineMessage[] {
  const quickReply = buildLineQuickReply(plan);
  const sender = options.sender;

  if (plan.card && plan.formats.includes('card')) {
    const template = getResponseTemplateByKey(plan.card.templateKey);
    if (template?.renderLine && canRenderResponseTemplate(template, plan.card.data)) {
      try {
        const rendered = template.renderLine(plan.card.data);
        if (rendered && typeof rendered === 'object') {
          return [attachLineMeta(rendered as LineMessage, sender, quickReply)];
        }
      } catch (error) {
        console.warn('[response-format] LINE card render failed:', error);
      }
    }
  }

  const rawText = resolveLineBodyText(plan);
  const cleanText = stripMarkdown(rawText).trim();
  const safeText = cleanText || 'No response available.';

  return buildReplyMessages(safeText, sender, quickReply);
}
