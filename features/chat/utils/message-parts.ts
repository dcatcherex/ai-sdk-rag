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
    .filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
