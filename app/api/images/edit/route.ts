import { generateImage } from 'ai';
import { and, desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import sharp from 'sharp';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset } from '@/db/schema';
import { uploadPublicObject } from '@/lib/r2';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';

const requestSchema = z.object({
  threadId: z.string().min(1),
  sourceAssetId: z.string().min(1),
  prompt: z.string().min(1),
  maskDataUrl: z.string().optional(),
  model: z.string().optional(),
});

type ImageFilePart = {
  type: 'file';
  mediaType: string;
  url: string;
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

const parseDataUrl = (url: string) => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    data: Buffer.from(match[2], 'base64'),
  };
};

const fetchImageBuffer = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to download source image.');
  }
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
};

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId, sourceAssetId, prompt, maskDataUrl, model } = requestSchema.parse(await req.json());

    const [threadRow] = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
      .limit(1);

    if (!threadRow) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const [sourceAsset] = await db
      .select({
        id: mediaAsset.id,
        url: mediaAsset.url,
        width: mediaAsset.width,
        height: mediaAsset.height,
        version: mediaAsset.version,
        rootAssetId: mediaAsset.rootAssetId,
      })
      .from(mediaAsset)
      .where(
        and(
          eq(mediaAsset.id, sourceAssetId),
          eq(mediaAsset.threadId, threadId),
          eq(mediaAsset.userId, session.user.id),
          eq(mediaAsset.type, 'image')
        )
      )
      .limit(1);

    if (!sourceAsset) {
      return Response.json({ error: 'Source image not found' }, { status: 404 });
    }

    const modelId = model ?? 'openai/gpt-image-1.5';
    const creditCost = getCreditCost(modelId);
    const currentBalance = await getUserBalance(session.user.id);
    if (currentBalance < creditCost) {
      return Response.json(
        {
          error: `Insufficient credits. This edit costs ${creditCost} credits, but you have ${currentBalance}.`,
        },
        { status: 402 }
      );
    }

    const sourceImageBuffer = await fetchImageBuffer(sourceAsset.url);
    const parsedMask = maskDataUrl ? parseDataUrl(maskDataUrl) : null;

    const imageResult = await generateImage({
      model: modelId,
      prompt: {
        text: prompt,
        images: [sourceImageBuffer],
        ...(parsedMask ? { mask: parsedMask.data } : {}),
      },
    });

    const generatedImage = imageResult.image;
    const generatedBuffer = Buffer.from(generatedImage.base64, 'base64');
    const image = sharp(generatedBuffer);
    const metadata = await image.metadata();
    const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
    const thumbnailBuffer = await image
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const width = metadata.width ?? sourceAsset.width ?? 1024;
    const height = metadata.height ?? sourceAsset.height ?? 1024;
    const messageId = crypto.randomUUID();
    const assetId = nanoid();
    const baseKey = ['chat-images', threadId, messageId, `${assetId}-edit`].join('/');
    const fullKey = `${baseKey}.webp`;
    const thumbKey = `${baseKey}-thumb.webp`;

    const [fullUpload, thumbUpload] = await Promise.all([
      uploadPublicObject({
        key: fullKey,
        body: webpBuffer,
        contentType: 'image/webp',
      }),
      uploadPublicObject({
        key: thumbKey,
        body: thumbnailBuffer,
        contentType: 'image/webp',
      }),
    ]);

    const rootAssetId = sourceAsset.rootAssetId ?? sourceAsset.id;
    const version = (sourceAsset.version ?? 1) + 1;

    const part: ImageFilePart = {
      type: 'file',
      mediaType: 'image/webp',
      url: fullUpload.url,
      filename: `image-v${version}.webp`,
      thumbnailUrl: thumbUpload.url,
      width,
      height,
      assetId,
      parentAssetId: sourceAsset.id,
      rootAssetId,
      version,
      editPrompt: prompt,
    };

    const [lastMessage] = await db
      .select({ position: chatMessage.position })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, threadId))
      .orderBy(desc(chatMessage.position))
      .limit(1);

    await db.insert(chatMessage).values({
      id: messageId,
      threadId,
      role: 'assistant',
      parts: [part],
      position: (lastMessage?.position ?? -1) + 1,
    });

    await db.insert(mediaAsset).values({
      id: assetId,
      userId: session.user.id,
      threadId,
      messageId,
      parentAssetId: sourceAsset.id,
      rootAssetId,
      version,
      editPrompt: prompt,
      type: 'image',
      r2Key: fullUpload.key,
      url: fullUpload.url,
      thumbnailKey: thumbUpload.key,
      thumbnailUrl: thumbUpload.url,
      mimeType: 'image/webp',
      width,
      height,
      sizeBytes: webpBuffer.byteLength,
    });

    await db
      .update(chatThread)
      .set({
        preview: prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt,
        updatedAt: new Date(),
      })
      .where(eq(chatThread.id, threadId));

    await deductCredits({
      userId: session.user.id,
      amount: creditCost,
      description: `Image edit: ${modelId} (thread ${threadId})`,
    });

    return Response.json({
      asset: {
        id: assetId,
        url: fullUpload.url,
        thumbnailUrl: thumbUpload.url,
        width,
        height,
        parentAssetId: sourceAsset.id,
        rootAssetId,
        version,
        editPrompt: prompt,
      },
      usage: imageResult.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
