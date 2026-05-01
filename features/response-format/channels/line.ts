import type { LineMessage, QuickReply, QuickReplyItem, Sender } from '@/features/line-oa/webhook/types';
import { buildReplyMessages } from '@/features/line-oa/webhook/flex';
import { stripMarkdown } from '@/features/line-oa/webhook/utils/markdown';
import { QUICK_REPLY_LABEL_MAX } from '@/features/line-oa/webhook/types';
import type { ResponsePlan, ResponseQuickReply } from '@/features/response-format/types';
import { canRenderResponseTemplate, getResponseTemplateByKey } from '@/features/response-format/template-registry';

type RenderResponseForLineOptions = {
  sender?: Sender;
};

const LINE_DIAGNOSIS_COMPACT_THRESHOLD = 900;

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

function shouldCompactDiagnosisText(plan: ResponsePlan, text: string): boolean {
  if (text.length <= LINE_DIAGNOSIS_COMPACT_THRESHOLD) return false;
  if (plan.intent === 'diagnosis' || plan.intent === 'advisory') return true;

  return (
    text.includes('ปัญหาที่น่าจะเป็น:')
    && text.includes('ควรทำทันที:')
  ) || (
    /likely (issue|problem|diagnosis):/i.test(text)
    && /(do now|immediate action|next steps):/i.test(text)
  );
}

function maybeCompactLineText(plan: ResponsePlan, text: string): string {
  if (!shouldCompactDiagnosisText(plan, text)) return text;

  const compacted = compactDiagnosisTextForLine(text);
  return compacted || text;
}

function compactDiagnosisTextForLine(text: string): string | null {
  const sections = splitDiagnosisSections(text);
  if (sections.size === 0) return null;

  const issue = firstLines(readSection(sections, ['ปัญหาที่น่าจะเป็น:', 'Likely issue:', 'Likely problem:', 'Likely diagnosis:']), 2);
  const confidence = firstLines(readSection(sections, ['ความมั่นใจ:', 'Confidence:']), 1);
  const severity = firstLines(readSection(sections, ['ระดับความรุนแรง:', 'Severity:']), 1);
  const actions = firstActionLines(readSection(sections, ['ควรทำทันที:', 'Do now:', 'Immediate action:', 'Next steps:']), 3);
  const escalation = firstLines(
    readSection(sections, ['ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:', 'When to contact an expert:', 'When to escalate:']),
    1,
  );
  const question = extractLastQuestion(text);

  const blocks = [
    ...(issue ? [`ปัญหาที่น่าจะเป็น:\n${issue}`] : []),
    ...(confidence || severity ? [[
      ...(confidence ? [`ความมั่นใจ: ${confidence}`] : []),
      ...(severity ? [`ระดับความรุนแรง: ${severity}`] : []),
    ].join('\n')] : []),
    ...(actions ? [`ควรทำทันที:\n${actions}`] : []),
    ...(escalation ? [`ควรติดต่อเจ้าหน้าที่เมื่อ:\n${escalation}`] : []),
    ...(question ? [question] : []),
  ];

  return blocks.length > 0 ? blocks.join('\n\n') : null;
}

function splitDiagnosisSections(text: string): Map<string, string[]> {
  const headings = [
    'ปัญหาที่น่าจะเป็น:',
    'ความมั่นใจ:',
    'ระดับความรุนแรง:',
    'ควรทำทันที:',
    'ป้องกันรอบต่อไป:',
    'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
    'Likely issue:',
    'Likely problem:',
    'Likely diagnosis:',
    'Confidence:',
    'Severity:',
    'Do now:',
    'Immediate action:',
    'Next steps:',
    'Prevention:',
    'When to contact an expert:',
    'When to escalate:',
  ];
  const sections = new Map<string, string[]>();
  let activeHeading: string | null = null;

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = headings.find((candidate) => line.startsWith(candidate));
    if (heading) {
      activeHeading = heading;
      const remainder = line.slice(heading.length).trim();
      sections.set(activeHeading, remainder ? [remainder] : []);
      continue;
    }

    if (activeHeading) {
      sections.get(activeHeading)?.push(line);
    }
  }

  return sections;
}

function readSection(sections: Map<string, string[]>, headings: string[]): string[] {
  for (const heading of headings) {
    const value = sections.get(heading);
    if (value?.length) return value;
  }

  return [];
}

function firstLines(lines: string[], count: number): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count)
    .join('\n');
}

function firstActionLines(lines: string[], count: number): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, count)
    .map((line, index) => (/^\d+[.)]\s/.test(line) ? line : `${index + 1}. ${line}`))
    .join('\n');
}

function extractLastQuestion(text: string): string | null {
  const question = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) =>
      /[?？]$/.test(line)
      || /(ไหม|มั้ย|หรือยัง|หรือไม่|แบบไหน|แค่ไหน|อะไร|ที่ไหน|เมื่อไร)(ครับ|ค่ะ|คะ)?$/.test(line),
    );

  return question ?? null;
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
  const lineText = cleanText ? maybeCompactLineText(plan, cleanText) : cleanText;
  const safeText = lineText || 'No response available.';

  return buildReplyMessages(safeText, sender, quickReply);
}
