import type { FlexTemplateType } from '@/db/schema/line-oa';

const LEGACY_FLEX_TEMPLATE_RICH_KEYS: Record<string, string> = {
  'agrispark-diagnosis-result': 'agriculture.diagnosis',
  'agrispark-weather-risk': 'agriculture.weather_risk',
  'agrispark-7day-forecast': 'agriculture.forecast_7day',
  'agrispark-log-confirm': 'agriculture.record_confirmation',
  'agrispark-record-entry': 'agriculture.record_entry',
  'agrispark-weekly-summary': 'agriculture.weekly_summary',
};

export function getLinkedRichTemplateKeyForFlexTemplateName(name: string): string | null {
  return LEGACY_FLEX_TEMPLATE_RICH_KEYS[name] ?? null;
}

export function inferFlexTemplateType(input: {
  templateType?: FlexTemplateType | null;
  richTemplateKey?: string | null;
  name?: string | null;
}): FlexTemplateType {
  if (input.templateType) {
    return input.templateType;
  }

  if (input.richTemplateKey || (input.name && getLinkedRichTemplateKeyForFlexTemplateName(input.name))) {
    return 'line_override';
  }

  return 'line_only';
}

export function inferLinkedRichTemplateKey(input: {
  richTemplateKey?: string | null;
  name?: string | null;
}): string | null {
  if (input.richTemplateKey) {
    return input.richTemplateKey;
  }

  if (input.name) {
    return getLinkedRichTemplateKeyForFlexTemplateName(input.name);
  }

  return null;
}
