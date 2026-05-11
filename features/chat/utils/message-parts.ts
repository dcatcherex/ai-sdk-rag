import type { TextUIPart } from 'ai';
import type { ChatMessagePart, StepControlPart } from '../types';

export const isStepControlPart = (
  part: ChatMessagePart
): part is StepControlPart =>
  part.type === 'step-start' ||
  part.type === 'step-finish' ||
  part.type === 'step-result';

export type RenderableChatMessagePart = Exclude<ChatMessagePart, StepControlPart>;

export const isRenderableMessagePart = (
  part: ChatMessagePart
): part is RenderableChatMessagePart => !isStepControlPart(part);

export const filterRenderableMessageParts = (parts: ChatMessagePart[]) =>
  parts.filter(isRenderableMessagePart);

export const getTextContentFromParts = (parts: ChatMessagePart[]) =>
  parts
    .flatMap((part) => {
      if (part.type === 'text') {
        return [(part as TextUIPart).text];
      }

      if (part.type === 'data-rich-message') {
        const data = (part as { data?: { fallbackText?: unknown } }).data;
        return typeof data?.fallbackText === 'string' ? [data.fallbackText] : [];
      }

      return [];
    })
    .join('\n');
