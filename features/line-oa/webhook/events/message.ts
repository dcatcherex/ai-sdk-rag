import { generateText, generateImage } from 'ai';
import { asc, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { generateFollowUpSuggestions } from '@/lib/follow-up-suggestions';
import { getUserMemoryContext, extractAndStoreMemory } from '@/lib/memory';
import type { AgentRow, LineMessage, LinkedUser, MessagePart, Sender } from '../types';
import { MAX_CONTEXT_MESSAGES } from '../types';
import { getOrCreateConversation } from '../db';
import { buildReplyMessages } from '../flex';
import { buildQuickReplyItem } from '../utils/quick-reply';
import { extractTextContent } from '../utils/text';
import { stripMarkdown } from '../utils/markdown';
import { consumeLinkToken, registerLineUser } from '@/features/line-oa/link/service';
import { createPaymentOrder, verifySlipAndCredit, sendPaymentQr } from '@/features/line-oa/payment/service';
import { CREDIT_PACKAGES, formatPackageMenu } from '@/features/line-oa/payment/packages';
import { uploadPublicObject } from '@/lib/r2';
import { buildContentMarketingLineTools } from '@/features/content-marketing/line-tools';
import { buildContentPlannerLineTools } from '@/features/content-calendar/line-tools';
import { buildLineMetricsTools } from '@/features/line-oa/metrics-tools';
import { recordMessageEvent } from '@/features/line-oa/analytics';
import { chatModel } from '@/lib/ai';
import { SIGNUP_BONUS_CREDITS } from '@/lib/credits';
import { GoogleGenAI } from '@google/genai';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';

/** Default model used for LINE image generation requests */
const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

/**
 * Models that support multimodal (vision) input.
 * Falls back to chatModel (Gemini) for vision if agent uses an unsupported model.
 */
const VISION_CAPABLE_PREFIXES = ['google/', 'openai/gpt-5', 'openai/gpt-4', 'anthropic/claude'];
function resolveVisionModel(modelId: string): string {
  return VISION_CAPABLE_PREFIXES.some((p) => modelId.startsWith(p)) ? modelId : chatModel;
}

type LineEvent = {
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; id: string };
};

type ChannelInfo = {
  id: string;
  userId: string;
  name: string;
  channelAccessToken: string;
};

/** Returns true when the user's text is asking to generate an image */
function wantsImageGeneration(text: string): boolean {
  const lower = text.toLowerCase();
  // English triggers
  if (
    lower.startsWith('create image') ||
    lower.startsWith('generate image') ||
    lower.includes('image of') ||
    lower.includes('draw ') ||
    lower.includes('illustration')
  ) return true;
  // Thai triggers: สร้างรูป, สร้างภาพ, วาดรูป, วาด, ทำรูป, ภาพของ, รูปของ
  return (
    lower.includes('สร้างรูป') ||
    lower.includes('สร้างภาพ') ||
    lower.includes('วาดรูป') ||
    lower.includes('วาด') ||
    lower.includes('ทำรูป') ||
    lower.includes('ภาพของ') ||
    lower.includes('รูปของ')
  );
}

/** Read an AsyncIterable stream into a Buffer */
async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/** Encode raw 16-bit mono PCM (24 kHz from Gemini TTS) to MP3 using lamejs */
function pcmToMp3(pcm: Buffer, sampleRate = 24000): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lamejs = require('lamejs') as { Mp3Encoder: new (ch: number, sr: number, kbps: number) => { encodeBuffer(l: Int16Array): Int8Array; flush(): Int8Array } };
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  const frameSize = 1152; // standard MP3 frame size
  const chunks: Buffer[] = [];

  for (let i = 0; i < samples.length; i += frameSize) {
    const frame = samples.subarray(i, i + frameSize);
    const encoded = encoder.encodeBuffer(frame);
    if (encoded.length > 0) chunks.push(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(Buffer.from(flushed.buffer, flushed.byteOffset, flushed.byteLength));

  return Buffer.concat(chunks);
}

/** Download a LINE audio message and transcribe it with Gemini */
async function transcribeLineAudio(messageId: string, channelAccessToken: string): Promise<string> {
  const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });
  const stream = await blobClient.getMessageContent(messageId);
  const audioBuffer = await streamToBuffer(stream as unknown as AsyncIterable<Uint8Array>);
  const base64 = audioBuffer.toString('base64');

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'audio/m4a', data: base64 } },
        { text: 'Transcribe this audio accurately, preserving the original language (including Thai). Return only the spoken words, nothing else.' },
      ],
    }],
  });
  return response.text?.trim() ?? '';
}

/** Returns true when the user's text is requesting video generation */
function wantsVideoGeneration(text: string): boolean {
  const lower = text.toLowerCase();
  // English
  if (
    lower.startsWith('create video') ||
    lower.startsWith('generate video') ||
    lower.startsWith('make a video') ||
    lower.includes('video of ')
  ) return true;
  // Thai: สร้างวิดีโอ, ทำวิดีโอ, สร้างคลิป, ทำคลิป, วิดีโอของ
  return (
    lower.includes('สร้างวิดีโอ') ||
    lower.includes('ทำวิดีโอ') ||
    lower.includes('สร้างคลิป') ||
    lower.includes('ทำคลิป') ||
    lower.includes('วิดีโอของ')
  );
}

/**
 * Generate a quick thumbnail image for a video (used as LINE previewImageUrl).
 * Uses the same image model as inline image generation.
 */
async function generateVideoPreview(prompt: string): Promise<string | undefined> {
  try {
    const imageResult = await generateImage({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: LINE_IMAGE_MODEL as any,
      prompt: `Video thumbnail for: ${prompt}`,
    });
    const { base64, mediaType } = imageResult.image;
    const ext = mediaType.includes('png') ? 'png' : 'jpg';
    const key = `line-video-previews/${crypto.randomUUID()}.${ext}`;
    const { url } = await uploadPublicObject({ key, body: Buffer.from(base64, 'base64'), contentType: mediaType });
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Trigger a KIE Veo video generation task and push the result to the LINE user
 * once it's ready. Fire-and-forget — the text acknowledgement is sent first.
 *
 * Pipeline: prompt → KIE Veo (veo3_fast) → poll until done → pushMessage (video + thumbnail)
 *           also generates a preview image in parallel while video renders
 */
async function generateAndDeliverVideo(
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
  prompt: string,
): Promise<void> {
  const apiKey = getKieApiKey();
  if (!apiKey) return;

  try {
    // Start Veo task + preview image generation in parallel
    const [{ taskId }, previewUrl] = await Promise.all([
      KieService.createVeoTask({ prompt, model: 'veo3_fast', aspectRatio: '16:9', generationType: 'TEXT_2_VIDEO' }, apiKey),
      generateVideoPreview(prompt),
    ]);

    // Poll up to 4 minutes (48 × 5 s)
    const MAX_POLLS = 48;
    const POLL_MS = 5000;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const statusData = await KieService.getVeoTaskStatus(taskId, apiKey);

      if (statusData.code !== 200 || !statusData.data) continue;
      const { successFlag } = statusData.data;

      if (successFlag === 0) continue; // still processing

      if (successFlag === 2 || successFlag === 3) {
        await lineClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: `ขออภัย การสร้างวิดีโอล้มเหลว กรุณาลองใหม่อีกครั้ง` }],
        });
        return;
      }

      if (successFlag === 1) {
        // Extract video URL — resultUrls may be a JSON string or (API-shape-dependent) an array
        let videoUrl = '';
        const raw: unknown = statusData.data.resultUrls;
        if (typeof raw === 'string') {
          try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) videoUrl = String(arr[0]); } catch { videoUrl = raw; }
        } else if (Array.isArray(raw) && raw.length > 0) {
          videoUrl = String(raw[0]);
        }
        if (!videoUrl) continue;

        await lineClient.pushMessage({
          to: lineUserId,
          messages: [{
            type: 'video',
            originalContentUrl: videoUrl,
            previewImageUrl: previewUrl ?? videoUrl, // fallback: LINE may render first frame
          } as LineMessage],
        });
        return;
      }
    }

    // Timeout
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: 'ขออภัย การสร้างวิดีโอใช้เวลานานเกินไป กรุณาลองใหม่' }],
    });
  } catch (err) {
    console.error('[LINE] Video generation failed:', err);
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: 'ขออภัย เกิดข้อผิดพลาดในการสร้างวิดีโอ กรุณาลองใหม่' }],
    }).catch(() => {});
  }
}

/**
 * Generate a TTS voice reply via Gemini (gemini-2.5-flash-preview-tts) and
 * push it to the LINE user as an MP3 audio message.
 * Fire-and-forget — always called after the text reply is already sent.
 * Pipeline: text → Gemini TTS (PCM 24kHz) → lamejs MP3 → R2 → LINE pushMessage
 */
async function sendVoiceReply(
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
  text: string,
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;
  const ttsText = text.slice(0, 500); // Keep audio manageable

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: ttsText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
      },
    });

    // Access raw PCM base64 from the first candidate part (per official docs)
    const pcmBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!pcmBase64) return;

    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const mp3Buffer = pcmToMp3(pcmBuffer);
    const durationMs = Math.round((pcmBuffer.length / (24000 * 2)) * 1000); // 24kHz 16-bit mono

    const key = `line-audio/${crypto.randomUUID()}.mp3`;
    const { url } = await uploadPublicObject({ key, body: mp3Buffer, contentType: 'audio/mpeg' });

    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'audio', originalContentUrl: url, duration: durationMs }],
    });
  } catch (err) {
    console.warn('[LINE] Voice reply failed:', err);
    // Fail silently — user already received the text reply
  }
}

/**
 * Handle an inbound message event (text, image, or audio).
 *
 * Text flow:
 *   image-gen intent  → generateImage → R2 upload → LINE image message
 *   otherwise         → generateText  → Flex / plain text reply
 *
 * Image flow (user sent a photo):
 *   download from LINE Content API → vision model → text reply
 *
 * Audio flow (user sent a voice note):
 *   download m4a → Gemini transcription → generateText → text reply
 *   + fire-and-forget: Gemini TTS → MP3 → R2 → pushMessage (voice reply)
 *
 * Video flow (user sent a video):
 *   download preview image → Gemini vision → text reply
 *
 * Video generation flow (text intent):
 *   reply "generating…" → fire-and-forget: KIE Veo task + preview image
 *   → poll until complete → pushMessage video + thumbnail
 */
export async function handleMessageEvent(
  event: LineEvent,
  channel: ChannelInfo,
  lineClient: messagingApi.MessagingApiClient,
  agentRow: AgentRow,
  sender: Sender | undefined,
  systemPrompt: string,
  modelId: string,
  linkedUser?: LinkedUser,
): Promise<void> {
  if (!event.replyToken) return;

  const msgType = event.message?.type;
  if (msgType !== 'text' && msgType !== 'image' && msgType !== 'audio' && msgType !== 'video') return;

  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // ① Account link command — text only
  if (msgType === 'text') {
    const userText = event.message!.text?.trim() ?? '';
    if (!userText) return;

    const linkMatch = userText.match(/^\/link\s+([A-Z2-9]{8})$/i);
    if (linkMatch) {
      const token = linkMatch[1]!.toUpperCase();
      const result = await consumeLinkToken(token, lineUserId, channel.id, lineClient);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: result.message }],
      });
      return;
    }

    // ① Registration command — create a Vaja AI account directly from LINE
    //   Triggers: สมัครสมาชิก, สมัคร, /register, register
    const isRegisterCommand =
      userText === 'สมัครสมาชิก' ||
      userText === 'สมัคร' ||
      userText.toLowerCase() === '/register' ||
      userText.toLowerCase() === 'register';

    if (isRegisterCommand) {
      const result = await registerLineUser(lineUserId, channel.id, lineClient);

      let replyText: string;
      if (!result.ok) {
        replyText = `ขออภัย ${result.error}`;
      } else if (!result.isNew) {
        replyText = 'คุณมีบัญชี Vaja AI อยู่แล้ว ใช้งานได้เลย! 😊';
      } else {
        replyText =
          `✅ สร้างบัญชีสำเร็จ! ยินดีต้อนรับ ${result.name} 🎉\n\n` +
          `คุณได้รับ ${SIGNUP_BONUS_CREDITS} เครดิตฟรีสำหรับเริ่มต้น\n` +
          `พิมพ์ข้อความเพื่อเริ่มคุยกับ AI ได้เลย`;
      }

      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
      return;
    }

    // ① Top-up command — show package menu
    const isTopupCommand =
      userText === 'เติมเครดิต' ||
      userText === 'เติมเงิน' ||
      userText.toLowerCase() === '/topup' ||
      userText.toLowerCase() === 'topup';

    if (isTopupCommand) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: formatPackageMenu() }],
      });
      return;
    }

    // ① Top-up package selection — user typed a number (1–4)
    const packageChoice = /^[1-4]$/.test(userText) ? parseInt(userText, 10) : 0;
    if (packageChoice >= 1 && packageChoice <= 4) {
      const pkg = CREDIT_PACKAGES[packageChoice - 1]!;
      const result = await createPaymentOrder(lineUserId, channel.id, pkg.id);

      if (!result.ok) {
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: result.error }],
        });
        return;
      }

      // Acknowledge immediately so the reply token is used, then push QR via pushMessage
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `กำลังสร้าง QR Code สำหรับ ${pkg.label} กรุณารอสักครู่...` }],
      });

      // Fire-and-forget: upload QR + push image + instructions
      void sendPaymentQr(lineClient, lineUserId, pkg, result.qrDataUrl, result.orderId);
      return;
    }
  }

  // ② Loading animation — fire-and-forget
  lineClient
    .showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 30 })
    .catch((err) => console.warn('[LINE] showLoadingAnimation failed:', err));

  const { threadId } = await getOrCreateConversation(
    channel.id,
    channel.userId,
    lineUserId,
    channel.name,
  );

  const historyRows = await db
    .select({ role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position))
    .limit(MAX_CONTEXT_MESSAGES);

  const historyMessages = historyRows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({
      role: r.role as 'user' | 'assistant',
      content: extractTextContent(r.parts as MessagePart[]),
    }))
    .filter((m) => m.content.length > 0);

  let memoryContext = '';
  if (linkedUser) {
    memoryContext = await getUserMemoryContext(linkedUser.userId);
  }

  let lineSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: You are replying via LINE messaging. ' +
    'Do NOT use markdown syntax (no **bold**, no # headers, no backticks). ' +
    'Use plain text only. For lists, use • as bullet character.';

  if (linkedUser) {
    if (linkedUser.displayName) {
      lineSystemPrompt += `\n\nThe user you are talking to is named ${linkedUser.displayName}. Address them by name naturally when appropriate.`;
    }
    if (memoryContext) {
      lineSystemPrompt += `\n\nWhat you already know about this user:\n${memoryContext}`;
    }
  }

  const now = new Date();
  const nextPosition = historyRows.length;

  // ③ Incoming image from user → slip verification OR vision model → text reply
  if (msgType === 'image') {
    const blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: channel.channelAccessToken,
    });

    const stream = await blobClient.getMessageContent(event.message!.id);
    const imageBuffer = await streamToBuffer(stream as unknown as AsyncIterable<Uint8Array>);
    const base64 = imageBuffer.toString('base64');

    // ③a Slip verification — check if this user has a pending payment order
    const slipResult = await verifySlipAndCredit(lineUserId, channel.id, base64, 'image/jpeg');
    if (slipResult.ok) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: [
            `✅ ชำระเงินสำเร็จ!`,
            ``,
            `ผู้ชำระ: ${slipResult.senderName}`,
            `เครดิตที่ได้รับ: +${slipResult.credits.toLocaleString()} เครดิต`,
            ``,
            `ขอบคุณที่ใช้บริการ Vaja AI 🙏`,
          ].join('\n'),
        }],
      });
      recordMessageEvent(channel.id, lineUserId).catch(() => {});
      return;
    }

    // If slip verification failed with "no pending order" it's a normal image — fall through to vision
    // If it failed due to invalid slip, inform the user
    if (slipResult.error && !slipResult.error.includes('ไม่พบคำสั่งซื้อ')) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `❌ ${slipResult.error}` }],
      });
      recordMessageEvent(channel.id, lineUserId).catch(() => {});
      return;
    }

    const { text: rawAnalysis } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolveVisionModel(modelId) as any,
      system: lineSystemPrompt,
      messages: [
        ...historyMessages,
        {
          role: 'user' as const,
          content: [{ type: 'image' as const, image: base64, mediaType: 'image/jpeg' }],
        },
      ],
    });

    if (!rawAnalysis) return;
    const analysisText = stripMarkdown(rawAnalysis);

    const contextStr = `user: [sent an image]\nassistant: ${analysisText.slice(0, 200)}`;
    const [suggestions] = await Promise.all([
      generateFollowUpSuggestions(contextStr),
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: '[Image]' }],
          position: nextPosition,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: analysisText }],
          position: nextPosition + 1,
          createdAt: now,
        },
      ]),
      db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
    ]);

    if (linkedUser) {
      const messagesForMemory = [
        ...historyMessages,
        { role: 'user' as const, content: '[Image]' },
        { role: 'assistant' as const, content: analysisText },
      ];
      void extractAndStoreMemory(linkedUser.userId, messagesForMemory, threadId, memoryContext);
    }

    const quickReplyItems = suggestions
      .filter((s) => s.trim().length > 0)
      .slice(0, 3)
      .map((s) => buildQuickReplyItem(s));
    const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

    const replyMessages = buildReplyMessages(analysisText, sender, quickReply);
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: replyMessages });
    recordMessageEvent(channel.id, lineUserId).catch(() => {});
    return;
  }

  // ④ Audio message (user sent a voice note) → transcribe → AI → text + voice reply
  if (msgType === 'audio') {
    const transcript = await transcribeLineAudio(event.message!.id, channel.channelAccessToken);
    if (!transcript) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ขออภัย ไม่สามารถแปลงเสียงเป็นข้อความได้ กรุณาลองพูดใหม่อีกครั้ง' }],
      });
      return;
    }

    const { text: rawAudioReply } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: modelId as any,
      system: lineSystemPrompt,
      messages: [...historyMessages, { role: 'user', content: transcript }],
    });

    if (!rawAudioReply) return;
    const audioReplyText = stripMarkdown(rawAudioReply);

    // Show the transcript so the user can confirm the AI heard them correctly
    const displayText = `🎙 "${transcript}"\n\n${audioReplyText}`;

    const audioContextStr = `user: [voice] ${transcript}\nassistant: ${audioReplyText.slice(0, 200)}`;
    const [audioSuggestions] = await Promise.all([
      generateFollowUpSuggestions(audioContextStr),
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: `[Voice] ${transcript}` }],
          position: nextPosition,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: audioReplyText }],
          position: nextPosition + 1,
          createdAt: now,
        },
      ]),
      db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
    ]);

    if (linkedUser) {
      void extractAndStoreMemory(
        linkedUser.userId,
        [...historyMessages, { role: 'user' as const, content: transcript }, { role: 'assistant' as const, content: audioReplyText }],
        threadId,
        memoryContext,
      );
    }

    const audioQuickReplyItems = audioSuggestions
      .filter((s) => s.trim().length > 0)
      .slice(0, 3)
      .map((s) => buildQuickReplyItem(s));
    const audioQuickReply = audioQuickReplyItems.length > 0 ? { items: audioQuickReplyItems } : undefined;

    const audioReplyMessages = buildReplyMessages(displayText, sender, audioQuickReply);
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: audioReplyMessages });

    // Fire-and-forget: send a voice reply via Gemini TTS → R2 → pushMessage
    void sendVoiceReply(lineClient, lineUserId, audioReplyText);

    recordMessageEvent(channel.id, lineUserId).catch(() => {});
    return;
  }

  // ⑤ Video message (user sent a video) → analyse preview frame → text reply
  if (msgType === 'video') {
    // Download the lightweight preview image instead of the full video file
    const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: channel.channelAccessToken });
    const previewStream = await blobClient.getMessageContentPreview(event.message!.id);
    const previewBuffer = await streamToBuffer(previewStream as unknown as AsyncIterable<Uint8Array>);
    const previewBase64 = previewBuffer.toString('base64');

    const { text: rawVideoReply } = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolveVisionModel(modelId) as any,
      system: lineSystemPrompt + '\n\nThe user sent a video. You are seeing a preview frame from that video.',
      messages: [
        ...historyMessages,
        {
          role: 'user' as const,
          content: [{ type: 'image' as const, image: previewBase64, mediaType: 'image/jpeg' }],
        },
      ],
    });

    if (!rawVideoReply) return;
    const videoReplyText = stripMarkdown(rawVideoReply);

    const videoContextStr = `user: [sent a video]\nassistant: ${videoReplyText.slice(0, 200)}`;
    const [videoSuggestions] = await Promise.all([
      generateFollowUpSuggestions(videoContextStr),
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: '[Video]' }],
          position: nextPosition,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: videoReplyText }],
          position: nextPosition + 1,
          createdAt: now,
        },
      ]),
      db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
    ]);

    if (linkedUser) {
      void extractAndStoreMemory(
        linkedUser.userId,
        [...historyMessages, { role: 'user' as const, content: '[Video]' }, { role: 'assistant' as const, content: videoReplyText }],
        threadId,
        memoryContext,
      );
    }

    const videoQuickReplyItems = videoSuggestions
      .filter((s) => s.trim().length > 0)
      .slice(0, 3)
      .map((s) => buildQuickReplyItem(s));
    const videoQuickReply = videoQuickReplyItems.length > 0 ? { items: videoQuickReplyItems } : undefined;

    const videoReplyMessages = buildReplyMessages(videoReplyText, sender, videoQuickReply);
    await lineClient.replyMessage({ replyToken: event.replyToken, messages: videoReplyMessages });
    recordMessageEvent(channel.id, lineUserId).catch(() => {});
    return;
  }

  // ⑥ Text message
  const userText = event.message!.text!.trim();

  // ⑥a Image generation request
  if (wantsImageGeneration(userText)) {
    try {
      const imageResult = await generateImage({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: LINE_IMAGE_MODEL as any,
        prompt: userText,
      });
      const { base64, mediaType } = imageResult.image;
      const ext = mediaType.includes('png') ? 'png' : 'jpg';
      const key = `line-images/${crypto.randomUUID()}.${ext}`;
      const { url } = await uploadPublicObject({
        key,
        body: Buffer.from(base64, 'base64'),
        contentType: mediaType,
      });

      await Promise.all([
        db.insert(chatMessage).values([
          {
            id: crypto.randomUUID(),
            threadId,
            role: 'user',
            parts: [{ type: 'text', text: userText }],
            position: nextPosition,
            createdAt: now,
          },
          {
            id: crypto.randomUUID(),
            threadId,
            role: 'assistant',
            parts: [{ type: 'text', text: `[Generated image: ${url}]` }],
            position: nextPosition + 1,
            createdAt: now,
          },
        ]),
        db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
      ]);

      const imageMsg: LineMessage = {
        type: 'image',
        originalContentUrl: url,
        previewImageUrl: url,
      } as LineMessage;
      await lineClient.replyMessage({ replyToken: event.replyToken, messages: [imageMsg] });
      recordMessageEvent(channel.id, lineUserId, { imagesSent: 1 }).catch(() => {});
      return;
    } catch (err) {
      console.error('[LINE] Image generation failed:', err);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ขออภัย ไม่สามารถสร้างภาพได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }],
      });
      recordMessageEvent(channel.id, lineUserId).catch(() => {});
      return;
    }
  }

  // ⑥b Video generation request
  if (wantsVideoGeneration(userText)) {
    // Save the request to history
    await Promise.all([
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: userText }],
          position: nextPosition,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: '[Generating video…]' }],
          position: nextPosition + 1,
          createdAt: now,
        },
      ]),
      db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
    ]);

    // Reply immediately — video delivery happens via pushMessage later
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'กำลังสร้างวิดีโอ กรุณารอสักครู่ จะส่งให้เมื่อพร้อม 🎬' }],
    });

    // Fire-and-forget: generate video + thumbnail → push when ready
    void generateAndDeliverVideo(lineClient, lineUserId, userText);

    recordMessageEvent(channel.id, lineUserId).catch(() => {});
    return;
  }

  // ⑥c Standard text → text response (with optional tool use for content agents)
  const enabledTools = agentRow?.enabledTools ?? [];
  const isContentAgent = enabledTools.includes('content_marketing');
  const isPlannerAgent = enabledTools.includes('content_planning');
  const isMetricsAgent = enabledTools.includes('line_analytics');

  const contentTools = isContentAgent
    ? buildContentMarketingLineTools(linkedUser?.userId ?? null)
    : undefined;
  const plannerTools = isPlannerAgent
    ? buildContentPlannerLineTools(linkedUser?.userId ?? null)
    : undefined;
  const metricsTools = isMetricsAgent
    ? buildLineMetricsTools(linkedUser?.userId ?? null, channel.id)
    : undefined;
  const mergedTools = (contentTools || plannerTools || metricsTools)
    ? { ...contentTools, ...plannerTools, ...metricsTools }
    : undefined;

  const generateResult = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: modelId as any,
    system: lineSystemPrompt,
    messages: [...historyMessages, { role: 'user', content: userText }],
    ...(mergedTools ? { tools: mergedTools, maxSteps: 3 } : {}),
  });

  const rawReplyText = generateResult.text;
  if (!rawReplyText) return;
  const replyText = stripMarkdown(rawReplyText);

  // Collect any image URLs produced by tool calls (e.g. generate_image tool)
  const toolImageUrls: string[] = (generateResult.toolResults ?? [])
    .flatMap((tr) => {
      const r = (tr as { output?: Record<string, unknown> }).output;
      return r?.imageUrl && typeof r.imageUrl === 'string' ? [r.imageUrl] : [];
    });

  const contextStr = [
    ...historyMessages.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 200)}`),
    `user: ${userText}`,
    `assistant: ${replyText.slice(0, 200)}`,
  ].join('\n');

  const [suggestions] = await Promise.all([
    generateFollowUpSuggestions(contextStr),
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        position: nextPosition,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: replyText }],
        position: nextPosition + 1,
        createdAt: now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
  ]);

  if (linkedUser) {
    const messagesForMemory = [
      ...historyMessages,
      { role: 'user' as const, content: userText },
      { role: 'assistant' as const, content: replyText },
    ];
    void extractAndStoreMemory(linkedUser.userId, messagesForMemory, threadId, memoryContext);
  }

  const quickReplyItems = suggestions
    .filter((s) => s.trim().length > 0)
    .slice(0, 3)
    .map((s) => buildQuickReplyItem(s));
  const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

  // Build text reply messages (Flex or plain)
  const textMessages = buildReplyMessages(replyText, sender, quickReply);

  // Append generated images from tool calls (max 4 total messages per LINE reply)
  const imageMessages: LineMessage[] = toolImageUrls
    .slice(0, Math.max(0, 4 - textMessages.length))
    .map((url) => ({ type: 'image', originalContentUrl: url, previewImageUrl: url } as LineMessage));

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [...textMessages, ...imageMessages],
  });

  // Fire-and-forget: record daily stats for this channel
  recordMessageEvent(channel.id, lineUserId, {
    toolCallCount: generateResult.toolResults?.length ?? 0,
    imagesSent: imageMessages.length,
  }).catch((err) => console.warn('[LINE] recordMessageEvent failed:', err));
}
