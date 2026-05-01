import type { ResponseTemplate } from '@/features/response-format/types';
import { COMMON_RESPONSE_TEMPLATES } from '@/features/response-format/templates/common';
import { AGRICULTURE_RESPONSE_TEMPLATES } from '@/features/response-format/templates/agriculture';
import { readRequiredData } from '@/features/response-format/templates/shared';

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  ...COMMON_RESPONSE_TEMPLATES,
  ...AGRICULTURE_RESPONSE_TEMPLATES,
];

const RESPONSE_TEMPLATE_BY_KEY = new Map(
  RESPONSE_TEMPLATES.map((template) => [template.key, template]),
);

export function getResponseTemplateByKey(key: string): ResponseTemplate | null {
  return RESPONSE_TEMPLATE_BY_KEY.get(key) ?? null;
}

export function listResponseTemplates(): ResponseTemplate[] {
  return RESPONSE_TEMPLATES;
}

export function canRenderResponseTemplate(
  template: ResponseTemplate,
  data: Record<string, unknown>,
): boolean {
  return readRequiredData(data, template.requiredDataKeys);
}
