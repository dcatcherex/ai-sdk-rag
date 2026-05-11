import type { ResponsePlan, WebResponseCard } from '@/features/response-format/types';
import { renderRichMessage, type RenderRichMessageResult } from '@/features/rich-messages/service';
import { renderRichMessageAsWebResponseCard } from '@/features/rich-messages/adapters/web';

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
  const richMessageResult = plan.card
    ? renderRichMessage({
      templateKey: plan.card.templateKey,
      data: plan.card.data,
      channel: 'web',
      locale: plan.locale,
      metadata: plan.metadata,
    })
    : null;

  return buildWebRenderedResponse(plan, richMessageResult);
}

export async function renderResponseForWebServer(plan: ResponsePlan): Promise<WebRenderedResponse> {
  const { renderRichMessageServer } = await import('@/features/rich-messages/server/runtime');
  const richMessageResult = plan.card
    ? await renderRichMessageServer({
      templateKey: plan.card.templateKey,
      data: plan.card.data,
      channel: 'web',
      locale: plan.locale,
      metadata: plan.metadata,
    })
    : null;

  return buildWebRenderedResponse(plan, richMessageResult);
}

function buildWebRenderedResponse(
  plan: ResponsePlan,
  richMessageResult: RenderRichMessageResult | null,
): WebRenderedResponse {
  const renderedCard =
    richMessageResult?.ok
      ? renderRichMessageAsWebResponseCard(richMessageResult.instance)
      : undefined;
  const hasRenderer = Boolean(richMessageResult?.ok);

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
          hasRenderer,
          ...(renderedCard ? { rendered: renderedCard } : {}),
        },
      }
      : {}),
    ...(plan.workflow ? { workflow: plan.workflow } : {}),
    metadata: plan.metadata,
  };
}
