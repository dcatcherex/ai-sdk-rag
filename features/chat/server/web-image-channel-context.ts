import type { ChatMessage } from '@/features/chat/types';
import {
  getImageAttachmentParts,
  getLatestAssistantImageParts,
  isFreshImageRegenerationRequest,
  isImplicitImageEditRequest,
} from './image-context';

export function buildImageChannelContext(input: {
  messages: ChatMessage[];
  lastUserPrompt: string | null | undefined;
}) {
  const { messages, lastUserPrompt } = input;

  const latestAssistantImageParts = getLatestAssistantImageParts(messages);
  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const latestUserImageParts = getImageAttachmentParts(latestUserMessage);
  const wantsFreshImageRegeneration = isFreshImageRegenerationRequest(lastUserPrompt);
  const shouldAutoReuseLastImage =
    latestAssistantImageParts.length > 0
    && latestUserImageParts.length === 0
    && isImplicitImageEditRequest(lastUserPrompt)
    && !wantsFreshImageRegeneration;
  const effectiveReferenceImageParts =
    latestUserImageParts.length > 0
      ? latestUserImageParts
      : shouldAutoReuseLastImage
        ? latestAssistantImageParts
        : [];

  const latestImageToolBlock =
    latestAssistantImageParts.length > 0
      ? `\n\n<latest_generated_images>
The most recent assistant-generated image(s) in this thread:
${latestAssistantImageParts.map((part, index) => `${index + 1}. ${part.url}`).join('\n')}
</latest_generated_images>

IMPORTANT: If the user asks to edit, modify, change, add to, remove from, or continue from the most recently generated image without attaching a new image, treat the image above as the reference image automatically. When calling the \`generate_image\` tool for that kind of follow-up, include these URL(s) in \`imageUrls\` instead of generating from scratch.`
      : '';

  const freshImageRegenerationBlock = `\n\nIMPORTANT: If the user asks for another version, a new theme, a new style, a different layout, a fresh variation, or says things like "ขอแบบใหม่", "ขออีกภาพ", or "เปลี่ยนธีม", do NOT automatically reuse the most recently generated image as an edit reference unless they explicitly say to keep/edit the same image. Treat those requests as fresh generation requests instead.`;

  const userAttachedImageUrls = latestUserImageParts.map((p) => p.url).filter((u) => u.startsWith('http'));
  const userAttachedImagesBlock =
    userAttachedImageUrls.length > 0
      ? `\n\n<user_attached_images>
The user has attached the following image(s) to their current message:
${userAttachedImageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}
</user_attached_images>

IMPORTANT: These are the exact URL(s) the user attached. If they want to generate, edit, or transform an image based on these attachments, you MUST include these URL(s) in the \`imageUrls\` parameter when calling \`generate_image\`. Do not omit \`imageUrls\` when the user has attached images.`
      : '';

  return {
    effectiveReferenceImageParts,
    imageBlocks: [latestImageToolBlock, freshImageRegenerationBlock, userAttachedImagesBlock] as [string, string, string],
  };
}
