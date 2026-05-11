import { getRichMessageTemplate } from '@/features/rich-messages/registry';
import { renderRichMessageTemplate, type RenderRichMessageInput, type RenderRichMessageResult } from '@/features/rich-messages/service';
import type { RichMessageTemplate } from '@/features/rich-messages/types';
import {
  buildRuntimeTemplateFromStoredRecord,
} from '@/features/rich-messages/server/service';
import {
  getDbRichMessageTemplateByKey,
  getPublishedDbRichMessageTemplateByKey,
} from '@/features/rich-messages/server/repository';

type ResolveServerRichMessageTemplateOptions = {
  includeDrafts?: boolean;
};

export async function getRichMessageTemplateServer(
  key: string,
  options: ResolveServerRichMessageTemplateOptions = {},
): Promise<RichMessageTemplate | null> {
  const builtInTemplate = getRichMessageTemplate(key);
  if (builtInTemplate) {
    return builtInTemplate;
  }

  try {
    const record = options.includeDrafts
      ? await getDbRichMessageTemplateByKey(key)
      : await getPublishedDbRichMessageTemplateByKey(key);

    return record ? buildRuntimeTemplateFromStoredRecord(record) : null;
  } catch {
    return null;
  }
}

export async function renderRichMessageServer(
  input: RenderRichMessageInput,
  options: ResolveServerRichMessageTemplateOptions = {},
): Promise<RenderRichMessageResult> {
  const template = await getRichMessageTemplateServer(input.templateKey, options);
  if (!template) {
    return { ok: false, error: 'template_not_found' };
  }

  return renderRichMessageTemplate(template, {
    data: input.data,
    channel: input.channel,
    locale: input.locale,
    metadata: input.metadata,
  });
}
