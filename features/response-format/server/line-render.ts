import { and, eq } from 'drizzle-orm';

import { lineFlexTemplate } from '@/db/schema/line-oa';
import { db } from '@/lib/db';
import { renderResponseForLine } from '@/features/response-format/channels/line';
import type { LineMessage, Sender } from '@/features/line-oa/webhook/types';
import type { ResponsePlan } from '@/features/response-format/types';

const FLEX_TEMPLATE_NAME_BY_RESPONSE_KEY: Record<string, string> = {
  'agriculture.diagnosis': 'agrispark-diagnosis-result',
  'agriculture.weather_risk': 'agrispark-weather-risk',
  'agriculture.forecast_7day': 'agrispark-7day-forecast',
  'agriculture.record_confirmation': 'agrispark-log-confirm',
  'agriculture.record_entry': 'agrispark-record-entry',
};

type CatalogFlexTemplate = {
  altText: string;
  flexPayload: Record<string, unknown>;
};

async function loadPublishedFlexTemplateByResponseKey(
  templateKey: string,
): Promise<CatalogFlexTemplate | null> {
  const templateName = FLEX_TEMPLATE_NAME_BY_RESPONSE_KEY[templateKey];
  if (!templateName) {
    return null;
  }

  const [row] = await db
    .select({
      altText: lineFlexTemplate.altText,
      flexPayload: lineFlexTemplate.flexPayload,
    })
    .from(lineFlexTemplate)
    .where(and(
      eq(lineFlexTemplate.name, templateName),
      eq(lineFlexTemplate.catalogStatus, 'published'),
    ))
    .limit(1);

  return row ?? null;
}

export async function renderResponseForLineFromCatalog(
  plan: ResponsePlan,
  options: { sender?: Sender } = {},
): Promise<LineMessage[]> {
  if (!plan.card || !plan.formats.includes('card')) {
    return renderResponseForLine(plan, options);
  }

  const template = await loadPublishedFlexTemplateByResponseKey(plan.card.templateKey);
  if (!template) {
    return renderResponseForLine(plan, options);
  }

  return renderResponseForLine(plan, {
    ...options,
    templateOverrides: {
      [plan.card.templateKey]: template,
    },
  });
}
