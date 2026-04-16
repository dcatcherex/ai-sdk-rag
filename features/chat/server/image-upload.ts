import sharp from 'sharp';
import { nanoid } from 'nanoid';
import type { UIDataTypes, UIMessagePart } from 'ai';
import type { ChatTools } from '@/lib/tools';
import { uploadPublicObject } from '@/lib/r2';
import type { ImageFilePart, UploadPartResult } from './schema';

export const isImageFilePart = (
  part: UIMessagePart<UIDataTypes, ChatTools>
): part is ImageFilePart => {
  if (part.type !== 'file') return false;
  const r = part as Record<string, unknown>;
  return (
    typeof r.mediaType === 'string' &&
    typeof r.url === 'string' &&
    r.mediaType.startsWith('image/')
  );
};

const parseDataUrl = (url: string) => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match) return null;
  return { mediaType: match[1], data: Buffer.from(match[2], 'base64') };
};

const fetchRemoteImage = async (url: string): Promise<{ data: Buffer; mediaType: string } | null> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const mediaType = contentType.split(';')[0]?.trim() ?? 'image/jpeg';
    if (!mediaType.startsWith('image/')) return null;
    const arrayBuffer = await response.arrayBuffer();
    return { data: Buffer.from(arrayBuffer), mediaType };
  } catch {
    return null;
  }
};

export const uploadImagePart = async (options: {
  part: ImageFilePart;
  threadId: string;
  messageId: string;
  index: number;
  userId: string;
}): Promise<UploadPartResult> => {
  const { part, threadId, messageId, index, userId } = options;

  let imageData: Buffer;

  const dataUrl = parseDataUrl(part.url);
  if (dataUrl) {
    imageData = dataUrl.data;
  } else if (part.url.startsWith('http')) {
    const remote = await fetchRemoteImage(part.url);
    if (!remote) return { part };
    imageData = remote.data;
  } else {
    return { part };
  }

  try {
    const image = sharp(imageData);
    const metadata = await image.metadata();
    const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
    const thumbnailBuffer = await sharp(imageData)
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 1024;
    const baseKey = `chat-images/${threadId}/${messageId}/${index + 1}-${nanoid(6)}`;
    const assetId = nanoid();

    const [fullUpload, thumbUpload] = await Promise.all([
      uploadPublicObject({ key: `${baseKey}.webp`, body: webpBuffer, contentType: 'image/webp' }),
      uploadPublicObject({ key: `${baseKey}-thumb.webp`, body: thumbnailBuffer, contentType: 'image/webp' }),
    ]);

    return {
      part: {
        ...part,
        url: fullUpload.url,
        mediaType: 'image/webp',
        filename: part.filename ?? `image-${index + 1}.webp`,
        thumbnailUrl: thumbUpload.url,
        width,
        height,
        assetId,
        rootAssetId: assetId,
        version: 1,
      },
      asset: {
        id: assetId,
        userId,
        threadId,
        messageId,
        rootAssetId: assetId,
        version: 1,
        editPrompt: part.editPrompt ?? null,
        type: 'image',
        r2Key: fullUpload.key,
        url: fullUpload.url,
        thumbnailKey: thumbUpload.key,
        thumbnailUrl: thumbUpload.url,
        mimeType: 'image/webp',
        width,
        height,
        sizeBytes: webpBuffer.byteLength,
      },
    };
  } catch (error) {
    console.error('Failed to upload image to R2:', error);
    return { part };
  }
};
