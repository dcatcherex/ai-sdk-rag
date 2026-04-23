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
    lower.includes('edit this image') ||
    lower.includes('edit the image') ||
    lower.includes('change this image') ||
    lower.includes('modify this image') ||
    lower.includes('update this image') ||
    lower.includes('use the same image') ||
    lower.includes('keep this image') ||
    lower.includes('same image') ||
    lower.includes('this image') ||
    lower.includes('this one') ||
    lower.includes('on this image') ||
    lower.includes('edit this') ||
    lower.includes('change it') ||
    lower.includes('make it') ||
    lower.includes('background') ||
    lower.includes('color') ||
    lower.includes('ภาพนี้') ||
    lower.includes('รูปนี้') ||
    lower.includes('ภาพเดิม') ||
    lower.includes('รูปเดิม') ||
    lower.includes('ใช้ภาพเดิม') ||
    lower.includes('ใช้รูปเดิม') ||
    lower.includes('แก้ภาพนี้') ||
    lower.includes('แก้รูปนี้') ||
    lower.includes('เปลี่ยนภาพนี้') ||
    lower.includes('เปลี่ยนรูปนี้') ||
    lower.includes('ภาพเดิม') ||
    lower.includes('รูปเดิม')
  );
}

export function isFreshImageRegenerationRequest(prompt: string | null | undefined): boolean {
  if (!prompt) return false;

  const lower = prompt.toLowerCase();
  return (
    lower.includes('another image') ||
    lower.includes('another one') ||
    lower.includes('new image') ||
    lower.includes('new version') ||
    lower.includes('different version') ||
    lower.includes('different image') ||
    lower.includes('new style') ||
    lower.includes('different style') ||
    lower.includes('new theme') ||
    lower.includes('different theme') ||
    lower.includes('another theme') ||
    lower.includes('regenerate') ||
    lower.includes('try again') ||
    lower.includes('start over') ||
    lower.includes('fresh version') ||
    lower.includes('another variant') ||
    lower.includes('ขออีกภาพ') ||
    lower.includes('ขออีกแบบ') ||
    lower.includes('ขอแบบใหม่') ||
    lower.includes('เอาแบบใหม่') ||
    lower.includes('ขอภาพใหม่') ||
    lower.includes('ภาพใหม่') ||
    lower.includes('แบบใหม่') ||
    lower.includes('อีกเวอร์ชัน') ||
    lower.includes('เวอร์ชันใหม่') ||
    lower.includes('ลองใหม่') ||
    lower.includes('เอาใหม่') ||
    lower.includes('ทำใหม่') ||
    lower.includes('ลองอีกแบบ') ||
    lower.includes('เปลี่ยนธีม') ||
    lower.includes('เปลี่ยนแนว') ||
    lower.includes('เปลี่ยนสไตล์') ||
    lower.includes('เปลี่ยนคอนเซปต์') ||
    lower.includes('อีกภาพหนึ่ง')
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
