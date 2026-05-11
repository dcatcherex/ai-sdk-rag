import { buildRichMessageFallbackText } from '@/features/rich-messages/fallback';
import { interpolateRichMessageValue } from '@/features/rich-messages/interpolation';
import { getRichMessageTemplate } from '@/features/rich-messages/registry';
import type {
  RichMessageChannel,
  RichMessageInstance,
  RichMessageLayout,
  RichMessageSection,
  RichMessageTemplate,
  RichMessageTone,
} from '@/features/rich-messages/types';

export type RenderRichMessageInput = {
  templateKey: string;
  data: Record<string, unknown>;
  channel?: RichMessageChannel;
  locale?: string;
  metadata?: Record<string, unknown>;
};

export type RenderRichMessageResult =
  | { ok: true; instance: RichMessageInstance }
  | {
      ok: false;
      error: 'template_not_found' | 'unsupported_channel' | 'invalid_data';
      issues?: string[];
    };

export function renderRichMessage(input: RenderRichMessageInput): RenderRichMessageResult {
  const template = getRichMessageTemplate(input.templateKey);
  if (!template) {
    return { ok: false, error: 'template_not_found' };
  }

  return renderRichMessageTemplate(template, input);
}

export function renderRichMessageTemplate(
  template: RichMessageTemplate,
  input: Omit<RenderRichMessageInput, 'templateKey'>,
): RenderRichMessageResult {
  if (input.channel && !template.supportedChannels.includes(input.channel)) {
    return { ok: false, error: 'unsupported_channel' };
  }

  const parsed = template.schema.safeParse(input.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid_data',
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    };
  }

  const resolvedLayout = resolveRichMessageLayout(template, parsed.data);
  const draftInstance: RichMessageInstance = {
    kind: 'rich_message',
    templateKey: template.key,
    intent: template.intent,
    altText: '',
    fallbackText: '',
    data: parsed.data,
    resolvedLayout,
    metadata: input.metadata,
  };
  const fallbackText = buildRichMessageFallbackText(draftInstance);
  const altText = resolveAltText(template, parsed.data, resolvedLayout, fallbackText);

  return {
    ok: true,
    instance: {
      ...draftInstance,
      altText,
      fallbackText,
    },
  };
}

function resolveRichMessageLayout(
  template: RichMessageTemplate,
  data: Record<string, unknown>,
): RichMessageLayout {
  const interpolated = interpolateRichMessageValue(template.layout, data);

  return {
    ...interpolated,
    sections: (interpolated.sections ?? []).map((section) => resolveSectionTone(section, data)),
    items: interpolated.items?.map((item) => interpolateRichMessageValue(item, data)),
  };
}

function resolveSectionTone(
  section: RichMessageSection,
  data: Record<string, unknown>,
): RichMessageSection {
  if (!section.toneFrom) {
    return section;
  }

  return {
    ...section,
    tone: resolveToneFromValue(data[section.toneFrom]) ?? section.tone,
  };
}

function resolveToneFromValue(value: unknown): RichMessageTone | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes('high')
    || normalized.includes('critical')
    || normalized.includes('danger')
    || normalized.includes('สูง')
    || normalized.includes('รุนแรง')
  ) {
    return 'danger';
  }

  if (
    normalized.includes('medium')
    || normalized.includes('moderate')
    || normalized.includes('warning')
    || normalized.includes('ปานกลาง')
  ) {
    return 'warning';
  }

  if (
    normalized.includes('low')
    || normalized.includes('safe')
    || normalized.includes('ต่ำ')
    || normalized.includes('น้อย')
  ) {
    return 'success';
  }

  return undefined;
}

function resolveAltText(
  template: RichMessageTemplate,
  data: Record<string, unknown>,
  resolvedLayout: RichMessageLayout,
  fallbackText: string,
): string {
  const configuredAltText = template.fallback?.altText
    ? interpolateRichMessageValue(template.fallback.altText, data).trim()
    : '';
  const normalizedTitle = resolvedLayout.title.trim();
  const normalizedSummary = resolvedLayout.summary?.trim() ?? '';

  const resolved = configuredAltText
    || (normalizedTitle && !normalizedTitle.includes('{{') ? normalizedTitle : '')
    || (normalizedSummary && !normalizedSummary.includes('{{') ? normalizedSummary : '')
    || fallbackText
    || template.title;

  return resolved.slice(0, 400);
}
