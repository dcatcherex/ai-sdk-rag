import { and, eq } from 'drizzle-orm';

import { lineFlexTemplate } from '@/db/schema/line-oa';
import { db } from '@/lib/db';
import { getLinkedRichTemplateKeyForFlexTemplateName } from '@/features/line-oa/flex/linking';
import { renderResponseForLine, renderResponseForLineServer } from '@/features/response-format/channels/line';
import type { LineMessage, Sender } from '@/features/line-oa/webhook/types';
import type { ResponsePlan } from '@/features/response-format/types';

type CatalogFlexTemplate = {
  altText: string;
  flexPayload: Record<string, unknown>;
};

async function loadPublishedFlexTemplateByResponseKey(
  templateKey: string,
): Promise<CatalogFlexTemplate | null> {
  const [row] = await db
    .select({
      altText: lineFlexTemplate.altText,
      flexPayload: lineFlexTemplate.flexPayload,
    })
    .from(lineFlexTemplate)
    .where(and(
      eq(lineFlexTemplate.richTemplateKey, templateKey),
      eq(lineFlexTemplate.templateType, 'line_override'),
      eq(lineFlexTemplate.catalogStatus, 'published'),
    ))
    .limit(1);

  if (row) {
    return row;
  }

  const legacyTemplateNames = [
    'agrispark-diagnosis-result',
    'agrispark-weather-risk',
    'agrispark-7day-forecast',
    'agrispark-log-confirm',
    'agrispark-record-entry',
    'agrispark-weekly-summary',
  ].filter((name) => getLinkedRichTemplateKeyForFlexTemplateName(name) === templateKey);

  for (const templateName of legacyTemplateNames) {
    const [legacyRow] = await db
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

    if (legacyRow) {
      return legacyRow;
    }
  }

  return null;
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
    return renderResponseForLineServer(plan, options);
  }

  return renderResponseForLineServer(plan, {
    ...options,
    templateOverrides: {
      [plan.card.templateKey]: template,
    },
  });
}
