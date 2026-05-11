import type { RichMessageTemplate } from '@/features/rich-messages/types';
import { AGRICULTURE_RICH_MESSAGE_TEMPLATES } from '@/features/rich-messages/templates/agriculture';
import { COMMON_RICH_MESSAGE_TEMPLATES } from '@/features/rich-messages/templates/common';

const RICH_MESSAGE_TEMPLATES: RichMessageTemplate[] = [
  ...COMMON_RICH_MESSAGE_TEMPLATES,
  ...AGRICULTURE_RICH_MESSAGE_TEMPLATES,
];

const RICH_MESSAGE_TEMPLATE_BY_KEY = new Map(
  RICH_MESSAGE_TEMPLATES.map((template) => [template.key, template]),
);

export function listRichMessageTemplates(): RichMessageTemplate[] {
  return RICH_MESSAGE_TEMPLATES;
}

export function getRichMessageTemplate(key: string): RichMessageTemplate | null {
  return RICH_MESSAGE_TEMPLATE_BY_KEY.get(key) ?? null;
}

export function hasRichMessageTemplate(key: string): boolean {
  return RICH_MESSAGE_TEMPLATE_BY_KEY.has(key);
}
