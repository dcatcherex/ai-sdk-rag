import {
  streamText,
  generateImage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { chatMessage, chatThread, mediaAsset, tokenUsage, userPreferences } from '@/db/schema';
import { availableModels, isStrongModel, type Capability } from '@/lib/ai';
import { getCreditCost, getUserBalance, deductCredits } from '@/lib/credits';
import { uploadPublicObject } from '@/lib/r2';
import { enhancePrompt } from '@/lib/prompt-enhance';
import { getUserMemoryContext, resolveMemoryPreferences } from '@/lib/memory';

export const maxDuration = 30;

const requestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  modelId: z.string().min(1),
  compareGroupId: z.string().min(1),
  threadId: z.string().min(1),
  userMessageId: z.string().min(1),
  userPrompt: z.string().min(1),
});

const modelHasCapability = (modelId: string, cap: Capability) => {
  const caps = availableModels.find((m) => m.id === modelId)?.capabilities ?? [];
  return caps.some((c) => c === cap);
};

const isImageCapableModel = (modelId: string) =>
  modelHasCapability(modelId, 'image gen');

export async function POST(req: Request) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { messages, modelId, compareGroupId, threadId, userMessageId, userPrompt } =
      requestSchema.parse(await req.json());

    // Verify thread ownership
    const threadRows = await db
      .select({ id: chatThread.id })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, authResult.user.id)))
      .limit(1);
    if (threadRows.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    const creditCost = getCreditCost(modelId);
    const balance = await getUserBalance(authResult.user.id);
    if (balance < creditCost) {
      return Response.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // Prompt enhancement (respects user preference, same as regular chat)
    const prefsRows = await db.select().from(userPreferences).where(eq(userPreferences.userId, authResult.user.id)).limit(1);
    const prefs = prefsRows[0] ?? null;
    const { shouldInject } = resolveMemoryPreferences(prefs);
    const memoryContext = shouldInject ? await getUserMemoryContext(authResult.user.id) : '';
    let effectivePrompt = userPrompt;
    // Skip enhancement for strong models — they handle ambiguity natively (same gate as chat route).
    if ((prefs?.promptEnhancementEnabled ?? true) && !isStrongModel(modelId)) {
      const enhanced = await enhancePrompt(userPrompt, memoryContext);
      if (enhanced !== userPrompt) {
        effectivePrompt = enhanced;
      }
    }

    // Persist user message (first compare call wins; others are ignored via onConflictDoNothing)
    await db
      .insert(chatMessage)
      .values({
        id: userMessageId,
        threadId,
        role: 'user',
        parts: [{ type: 'text', text: userPrompt }],
        metadata: { compareGroupId },
        position: 99000,
      })
      .onConflictDoNothing();

    const modelInfo = availableModels.find((m) => m.id === modelId);
    const assistantMessageId = crypto.randomUUID();

    if (isImageCapableModel(modelId)) {
      const imageResult = await generateImage({ model: modelId, prompt: effectivePrompt });
      const image = imageResult.image;
      let finalUrl = `data:${image.mediaType};base64,${image.base64}`;
      let thumbnailUrl: string | undefined;
      const assetId = nanoid();

      try {
        const buf = Buffer.from(image.base64, 'base64');
        const sharpImg = sharp(buf);
        const meta = await sharpImg.metadata();
        const webpBuf = await sharpImg.webp({ quality: 80 }).toBuffer();
        const thumbBuf = await sharp(buf)
          .resize({ width: 320, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        const baseKey = `compare-images/${threadId}/${assistantMessageId}/${nanoid(6)}`;
        const [fullUpload, thumbUpload] = await Promise.all([
          uploadPublicObject({ key: `${baseKey}.webp`, body: webpBuf, contentType: 'image/webp' }),
          uploadPublicObject({
            key: `${baseKey}-thumb.webp`,
            body: thumbBuf,
            contentType: 'image/webp',
          }),
        ]);
        finalUrl = fullUpload.url;
        thumbnailUrl = thumbUpload.url;

        await db.insert(mediaAsset).values({
          id: assetId,
          userId: authResult.user.id,
          threadId,
          messageId: assistantMessageId,
          rootAssetId: assetId,
          version: 1,
          editPrompt: userPrompt,
          type: 'image',
          r2Key: fullUpload.key,
          url: finalUrl,
          thumbnailKey: thumbUpload.key,
          thumbnailUrl,
          mimeType: 'image/webp',
          width: meta.width ?? 1024,
          height: meta.height ?? 1024,
          sizeBytes: webpBuf.byteLength,
        });
      } catch (e) {
        console.error('Compare image upload failed', e);
      }

      const assistantMetadata = {
        compareGroupId,
        compareModelId: modelId,
        compareModelName: modelInfo?.name ?? modelId,
      };

      await db.insert(chatMessage).values({
        id: assistantMessageId,
        threadId,
        role: 'assistant',
        parts: [{ type: 'file', mediaType: 'image/webp', url: finalUrl, thumbnailUrl, assetId }],
        metadata: assistantMetadata,
        position: 99001 + Date.now() % 1000,
      });

      await deductCredits({
        userId: authResult.user.id,
        amount: creditCost,
        description: `Compare: ${modelId}`,
      });

      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: ({ writer }) => {
            writer.write({ type: 'start', messageMetadata: assistantMetadata });
            writer.write({ type: 'start-step' });
            writer.write({ type: 'file', mediaType: 'image/webp', url: finalUrl });
            writer.write({ type: 'finish-step' });
            writer.write({ type: 'finish', finishReason: 'stop' });
          },
        }),
      });
    }

    // Replace the last user message with the enhanced prompt for LLM context
    const messagesForLLM: UIMessage[] =
      effectivePrompt !== userPrompt
        ? messages.map((m, i) =>
            i === messages.length - 1 && m.role === 'user'
              ? { ...m, parts: m.parts.map((p) => (p.type === 'text' ? { ...p, text: effectivePrompt } : p)) }
              : m
          )
        : messages;

    const result = streamText({
      model: modelId,
      messages: await convertToModelMessages(messagesForLLM),
    });

    const assistantMetadata = {
      compareGroupId,
      compareModelId: modelId,
      compareModelName: modelInfo?.name ?? modelId,
    };

    return result.toUIMessageStreamResponse({
      messageMetadata: () => assistantMetadata,
      onFinish: async ({ messages: updatedMessages }) => {
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        if (lastMsg) {
          await db
            .insert(chatMessage)
            .values({
              id: assistantMessageId,
              threadId,
              role: 'assistant',
              parts: lastMsg.parts,
              metadata: assistantMetadata,
              position: 99001 + Date.now() % 1000,
            })
            .onConflictDoNothing();
        }

        await deductCredits({
          userId: authResult.user.id,
          amount: creditCost,
          description: `Compare: ${modelId}`,
        });

        const usage = (await result.usage) as {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        } | null;
        if (usage) {
          await db
            .insert(tokenUsage)
            .values({
              id: nanoid(),
              threadId,
              model: modelId,
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens:
                usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
            })
            .catch(console.error);
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
