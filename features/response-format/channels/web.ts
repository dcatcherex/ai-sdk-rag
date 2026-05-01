import { getResponseTemplateByKey } from '@/features/response-format/template-registry';
import type { ResponsePlan, WebResponseCard } from '@/features/response-format/types';

export type WebRenderedResponse = {
  intent: ResponsePlan['intent'];
  formats: ResponsePlan['formats'];
  title?: string;
  summary?: string;
  bodyText: string;
  card?: {
    templateKey: string;
    data: Record<string, unknown>;
    hasRenderer: boolean;
    rendered?: WebResponseCard;
  };
  workflow?: ResponsePlan['workflow'];
  metadata?: Record<string, unknown>;
};

export function renderResponseForWeb(plan: ResponsePlan): WebRenderedResponse {
  const template = plan.card ? getResponseTemplateByKey(plan.card.templateKey) : null;
  const renderedCard =
    template?.renderWeb && plan.card ? template.renderWeb(plan.card.data) : undefined;

  return {
    intent: plan.intent,
    formats: plan.formats,
    title: plan.title,
    summary: plan.summary,
    bodyText: plan.bodyText,
    ...(plan.card
      ? {
          card: {
            templateKey: plan.card.templateKey,
            data: plan.card.data,
            hasRenderer: Boolean(template?.renderWeb),
            ...(renderedCard ? { rendered: renderedCard } : {}),
          },
        }
      : {}),
    ...(plan.workflow ? { workflow: plan.workflow } : {}),
    metadata: plan.metadata,
  };
}
