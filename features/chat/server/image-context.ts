import type { ChatMessage } from '@/features/chat/types';
import { inferChatImageTaskHint, resolveAdminImageModel } from '@/features/image/model-selection';

export type ImageAttachmentPart = {
  type: 'file';
  url: string;
  mediaType: string;
  filename?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  assetId?: string;
  parentAssetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

export async function mapToKieImageModel(
  resolvedModel: string,
  options: {
    hasImages: boolean;
    prompt?: string | null;
    hasActiveBrand: boolean;
  },
): Promise<{ kieModelId: string; enablePro?: boolean; taskHint?: string }> {
  switch (resolvedModel) {
    case 'openai/gpt-image-1.5':
      return { kieModelId: options.hasImages ? 'gpt-image/1.5-image-to-image' : 'gpt-image/1.5-text-to-image' };
    case 'xai/grok-imagine-image':
      return { kieModelId: options.hasImages ? 'grok-imagine/image-to-image' : 'grok-imagine/text-to-image' };
    case 'xai/grok-imagine-image-pro':
      return {
        kieModelId: options.hasImages ? 'grok-imagine/image-to-image' : 'grok-imagine/text-to-image',
        enablePro: true,
      };
    default:
      const taskHint = inferChatImageTaskHint({
        prompt: options.prompt,
        hasImages: options.hasImages,
        hasActiveBrand: options.hasActiveBrand,
      });
      const selection = await resolveAdminImageModel({ taskHint });
      return {
        kieModelId: selection.modelId,
        ...(selection.enablePro !== undefined ? { enablePro: selection.enablePro } : {}),
        ...(taskHint ? { taskHint } : {}),
      };
  }
}

export function isImplicitImageEditRequest(prompt: string | null | undefined): boolean {
  if (!prompt) return false;

  const lower = prompt.toLowerCase();
  return (
    /\b(change|edit|modify|update|replace|remove|erase|add|make|turn)\b/.test(lower) ||
    lower.includes('make it') ||
    lower.includes('change it') ||
    lower.includes('edit this') ||
    lower.includes('edit the image') ||
    lower.includes('same image') ||
    lower.includes('this image') ||
    lower.includes('this one') ||
    lower.includes('the cat') ||
    lower.includes('the dog') ||
    lower.includes('background') ||
    lower.includes('color')
  );
}

export function getImageAttachmentParts(message: ChatMessage | undefined): ImageAttachmentPart[] {
  if (!message?.parts?.length) return [];

  return message.parts.filter((part): part is ImageAttachmentPart => {
    if (!part || typeof part !== 'object') return false;
    const record = part as Record<string, unknown>;
    return (
      record.type === 'file' &&
      typeof record.url === 'string' &&
      typeof record.mediaType === 'string' &&
      record.mediaType.startsWith('image/')
    );
  });
}

export function getLatestAssistantImageParts(messages: ChatMessage[]): ImageAttachmentPart[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    const imageParts = getImageAttachmentParts(message);
    if (imageParts.length > 0) return imageParts;
  }

  return [];
}
