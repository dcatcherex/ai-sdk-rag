import { generateText, generateImage, stepCountIs } from 'ai';
import { asc, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { chatMessage, chatThread, userPreferences } from '@/db/schema';
import { generateLineFollowUpSuggestions as generateFollowUpSuggestions } from '../utils/follow-up-suggestions';
import {
  getUserMemoryContext,
  getLineUserMemoryContext,
  extractAndStoreMemory,
  extractAndStoreLineUserMemory,
  resolveMemoryPreferences,
} from '@/lib/memory';
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
import { FRIENDLY_STICKERS, pickRandom, shouldAddFriendlySticker } from '@/features/line-oa/utils/stickers';
import { recordMessageEvent } from '@/features/line-oa/analytics';
import { chatModel } from '@/lib/ai';
import { modelSupportsCapability } from '@/features/chat/server/routing';
import { SIGNUP_BONUS_CREDITS } from '@/lib/credits';
import { GoogleGenAI } from '@google/genai';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import { buildLineToolSet, LINE_IMAGE_MODEL, pollAndPushGeneratedLineImage } from '../tools';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';
import { LINE_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import {
  buildAgentRunSystemPrompt,
  EMPTY_SKILL_RUNTIME,
  resolveAgentBrandRuntime,
} from '@/features/agents/server/runtime';
import { resolveRelevantDomainContext } from '@/features/domain-profiles/service';
import { renderDomainContextPromptBlock } from '@/features/domain-profiles/server/prompt';
import { buildAgricultureSetupPromptBlock } from '@/features/domain-profiles/server/agriculture';
import {
  prepareAgentRun,
  runAgentText,
  startCanonicalAgentImageGeneration,
} from '@/features/agents/server/run-service';
import { wantsImageGeneration } from '@/features/agents/server/media-intent';

export { wantsImageGeneration };

/**
 * Falls back to chatModel (Gemini) for vision if agent uses an unsupported model.
 * Vision-capable models are declared in lib/ai.ts availableModels capabilities.
 */
function resolveVisionModel(modelId: string): string {
  return modelSupportsCapability(modelId, 'vision') ? modelId : chatModel;
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
  memberRichMenuLineId?: string | null;
};

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

/** Returns true when the user's text asks LINE to create a visual asset. */
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
 * Vision-based PromptPay slip detection.
 * Returns the detected amount if the image looks like a Thai payment slip, null otherwise.
 * Uses a cheap Gemini call with JSON mode to keep latency low.
 */
async function detectPaymentSlip(base64: string): Promise<number | null> {
  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: 'Is this a Thai PromptPay or bank transfer payment slip? Reply ONLY with valid JSON, no markdown: {"isSlip":true/false,"amountThb":number_or_null}' },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });
    const text = response.text?.trim() ?? '{}';
    const parsed = JSON.parse(text) as { isSlip?: boolean; amountThb?: number | null };
    return parsed.isSlip && typeof parsed.amountThb === 'number' ? parsed.amountThb : null;
  } catch {
    return null;
  }
}

async function deriveImageObservation(base64: string, modelId: string): Promise<string> {
  const { text } = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: resolveVisionModel(modelId) as any,
    system: [
      'You are preparing a concise observation for an agricultural assistant.',
      'Describe only what is visually observable in the image.',
      'Mention likely crop if visible, affected plant part, colors, spots, wilting, mold, insects, and spread pattern.',
      'Do not diagnose and do not recommend treatment.',
      'If uncertain, say what is unclear.',
      'Return plain text only in 2-4 short sentences.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: [{ type: 'image', image: base64, mediaType: 'image/jpeg' }],
      },
    ],
  });

  return stripMarkdown(text ?? '').trim();
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
  skillRuntime: SkillRuntimeContext = EMPTY_SKILL_RUNTIME,
  groupId?: string,
): Promise<void> {
  if (!event.replyToken) return;
  const replyToken = event.replyToken;

  const msgType = event.message?.type;
  if (msgType !== 'text' && msgType !== 'image' && msgType !== 'audio' && msgType !== 'video') return;
  const textMessage = msgType === 'text' ? event.message?.text?.trim() ?? '' : '';

  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const activeLineUserId = lineUserId;

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
        // Switch new member to the member rich menu if one is configured
        if (channel.memberRichMenuLineId) {
          void lineClient.linkRichMenuIdToUser(lineUserId, channel.memberRichMenuLineId);
        }
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
    groupId,
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
  let shouldExtractMemory = false;
  if (linkedUser) {
    // Linked account — respect user preference flags
    const prefsRows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, linkedUser.userId))
      .limit(1);
    const { shouldInject, shouldExtract } = resolveMemoryPreferences(prefsRows[0] ?? null);
    shouldExtractMemory = shouldExtract;
    if (shouldInject) {
      memoryContext = await getUserMemoryContext(linkedUser.userId);
    }
  } else if (lineUserId) {
    // Unlinked LINE user — memory keyed by LINE user ID (no prefs row, defaults to enabled)
    memoryContext = await getLineUserMemoryContext(lineUserId);
    shouldExtractMemory = true;
  }

  let lineBase =
    systemPrompt +
    '\n\nIMPORTANT: You are replying via LINE messaging. ' +
    'Do NOT use markdown syntax (no **bold**, no # headers, no backticks). ' +
    'Use plain text only. For lists, use • as bullet character.';

  if (groupId) {
    lineBase += '\n\nYou are in a LINE group chat shared by multiple users. Keep replies concise and relevant to the whole group.';
    if (linkedUser?.displayName) {
      lineBase += ` The member who sent this message is ${linkedUser.displayName}.`;
    }
  } else if (linkedUser?.displayName) {
    lineBase += `\n\nThe user you are talking to is named ${linkedUser.displayName}. Address them by name naturally when appropriate.`;
  }

  const { brandResolution, activeBrand } = await resolveAgentBrandRuntime({
    userId: channel.userId,
    activeBrandId: null,
    agent: agentRow,
    enabled: true,
  });

  const domainContext = await resolveRelevantDomainContext(
    {
      profileLimit: 10,
      entityLimit: 8,
    },
    linkedUser?.userId
      ? { userId: linkedUser.userId }
      : { lineUserId, channelId: channel.id },
  );
  const domainContextBlock = renderDomainContextPromptBlock(domainContext);
  const domainSetupBlock = buildAgricultureSetupPromptBlock({
    userMessage: textMessage,
    context: domainContext,
    skillRuntime,
  });

  const lineSystemPrompt = buildAgentRunSystemPrompt({
    base: lineBase,
    conversationSummaryBlock: '',
    threadWorkingMemoryBlock: '',
    isGrounded: false,
    activeBrand,
    memoryContext,
    sharedMemoryBlock: '',
    domainContextBlock,
    domainSetupBlock,
    skillRuntime,
    examPrepBlock: '',
    certBlock: '',
    quizContextBlock: '',
    brandPromptInstruction: brandResolution?.promptInstruction,
  });

  const now = new Date();
  const nextPosition = historyRows.length;

  const lineExtraBlocks = groupId
    ? [
        `\n\n<line_group_context>\nYou are in a LINE group chat shared by multiple users. Keep replies concise and relevant to the whole group.${linkedUser?.displayName ? ` The member who sent this message is ${linkedUser.displayName}.` : ''}\n</line_group_context>`,
      ]
    : linkedUser?.displayName
      ? [
          `\n\n<line_user_context>\nThe user you are talking to is named ${linkedUser.displayName}. Address them by name naturally when appropriate.\n</line_user_context>`,
        ]
      : [];

  async function runCanonicalLineReply(input: {
    runtimeUserText: string;
    storedUserText?: string;
    memoryUserText?: string;
    displayReplyText?: (replyText: string) => string;
  }) {
    const prepared = await prepareAgentRun({
      identity: {
        channel: 'line',
        userId: linkedUser?.userId ?? null,
        billingUserId: channel.userId,
        lineUserId,
        isOwner: linkedUser?.userId === channel.userId,
      },
      threadId,
      agentId: agentRow?.id ?? null,
      model: modelId,
      messages: [...historyMessages, { role: 'user', content: input.runtimeUserText }],
      policy: LINE_AGENT_RUN_POLICY,
      channelContext: {
        memoryContext,
        lineChannelId: channel.id,
        extraBlocks: lineExtraBlocks,
      },
    });

    const mergedTools = buildLineToolSet({
      enabledToolIds: prepared.activeToolIds ?? [],
      userId: channel.userId,
      brandId: prepared.activeBrand?.id ?? undefined,
      lineUserId: activeLineUserId,
      channelId: channel.id,
      threadId,
      lineClient,
    });

    const generateResult = await runAgentText({
      ...prepared,
      ...(prepared.supportsTools ? { tools: mergedTools } : {}),
    });

    const rawReplyText = generateResult.text;
    if (!rawReplyText) return null;

    const replyText = stripMarkdown(rawReplyText);
    const displayText = input.displayReplyText ? input.displayReplyText(replyText) : replyText;
    const storedUserText = input.storedUserText ?? input.runtimeUserText;
    const memoryUserText = input.memoryUserText ?? input.runtimeUserText;

    const contextStr = [
      ...historyMessages.slice(-4).map((message) => `${message.role}: ${message.content.slice(0, 200)}`),
      `user: ${storedUserText.slice(0, 200)}`,
      `assistant: ${replyText.slice(0, 200)}`,
    ].join('\n');

    const [suggestions] = await Promise.all([
      generateFollowUpSuggestions(contextStr),
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId,
          role: 'user',
          parts: [{ type: 'text', text: storedUserText }],
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

    if (shouldExtractMemory) {
      const messagesForMemory = [
        ...historyMessages,
        { role: 'user' as const, content: memoryUserText },
        { role: 'assistant' as const, content: replyText },
      ];
      if (linkedUser) {
        void extractAndStoreMemory(linkedUser.userId, messagesForMemory, threadId, memoryContext);
      } else if (lineUserId) {
        void extractAndStoreLineUserMemory(lineUserId, messagesForMemory, threadId, memoryContext);
      }
    }

    const quickReplyItems = suggestions
      .filter((suggestion) => suggestion.trim().length > 0)
      .slice(0, 3)
      .map((suggestion) => buildQuickReplyItem(suggestion));
    const quickReply = quickReplyItems.length > 0 ? { items: quickReplyItems } : undefined;

    const textMessages = buildReplyMessages(displayText, sender, quickReply);
    const imageMessages: LineMessage[] = generateResult.imageUrls
      .slice(0, Math.max(0, 4 - textMessages.length))
      .map((url) => ({ type: 'image', originalContentUrl: url, previewImageUrl: url } as LineMessage));

    const stickerMessages: LineMessage[] = [];
    if (generateResult.imageUrls.length === 0 && shouldAddFriendlySticker(replyText)) {
      const sticker = pickRandom(FRIENDLY_STICKERS);
      stickerMessages.push({
        type: 'sticker',
        packageId: sticker.packageId,
        stickerId: sticker.stickerId,
      } as LineMessage);
    }

    await lineClient.replyMessage({
      replyToken,
      messages: [...textMessages, ...imageMessages, ...stickerMessages],
    });

    recordMessageEvent(channel.id, activeLineUserId, {
      toolCallCount: generateResult.toolCallCount,
      imagesSent: imageMessages.length,
    }).catch((err) => console.warn('[LINE] recordMessageEvent failed:', err));

    return { replyText };
  }

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

    // If slip verification failed due to invalid/duplicate slip — inform user and stop
    if (slipResult.error && !slipResult.error.includes('ไม่พบคำสั่งซื้อ')) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `❌ ${slipResult.error}` }],
      });
      recordMessageEvent(channel.id, lineUserId).catch(() => {});
      return;
    }

    // No pending order — use vision to check if this looks like a PromptPay slip
    // If it does, auto-create the matching order and re-verify (removes the "select package first" step)
    const detectedAmount = await detectPaymentSlip(base64);
    if (detectedAmount !== null) {
      const matchedPkg = CREDIT_PACKAGES.find((p) => Math.abs(p.amountThb - detectedAmount) < 1);
      if (matchedPkg) {
        const orderResult = await createPaymentOrder(lineUserId, channel.id, matchedPkg.id);
        if (orderResult.ok) {
          const autoVerifyResult = await verifySlipAndCredit(lineUserId, channel.id, base64, 'image/jpeg');
          if (autoVerifyResult.ok) {
            await lineClient.replyMessage({
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: [
                  `✅ ชำระเงินสำเร็จ!`,
                  ``,
                  `ผู้ชำระ: ${autoVerifyResult.senderName}`,
                  `เครดิตที่ได้รับ: +${autoVerifyResult.credits.toLocaleString()} เครดิต`,
                  ``,
                  `ขอบคุณที่ใช้บริการ Vaja AI 🙏`,
                ].join('\n'),
              }],
            });
            recordMessageEvent(channel.id, lineUserId).catch(() => {});
            return;
          }
          // Auto-verify failed — show the error
          if (autoVerifyResult.error && !autoVerifyResult.error.includes('ไม่พบคำสั่งซื้อ')) {
            await lineClient.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: `❌ ${autoVerifyResult.error}` }],
            });
            recordMessageEvent(channel.id, lineUserId).catch(() => {});
            return;
          }
        }
      } else {
        // Amount detected but doesn't match any package
        await lineClient.replyMessage({
          replyToken: event.replyToken,
          messages: [{
            type: 'text',
            text: [
              `⚠️ พบสลิปชำระเงิน ฿${detectedAmount.toLocaleString()} แต่ไม่ตรงกับแพ็กเกจที่มี`,
              ``,
              `แพ็กเกจที่รองรับ: ฿100 / ฿300 / ฿500 / ฿1,000`,
              `พิมพ์ "เติมเครดิต" เพื่อดูรายการแพ็กเกจ`,
            ].join('\n'),
          }],
        });
        recordMessageEvent(channel.id, lineUserId).catch(() => {});
        return;
      }
    }

    const observation = await deriveImageObservation(base64, modelId);
    const runtimeUserText = [
      '[Farmer sent photo]',
      observation ? `Observation: ${observation}` : 'Observation: Image received but the visual details were unclear.',
      'Please help using the normal Farm Advisor workflow. Diagnose cautiously and ask only one short follow-up question if needed.',
    ].join('\n');

    const storedUserText = [
      '[Image]',
      observation ? `Observation: ${observation}` : 'Observation: Unable to derive a clear observation.',
    ].join('\n');

    await runCanonicalLineReply({
      runtimeUserText,
      storedUserText,
      memoryUserText: runtimeUserText,
    });
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

    const result = await runCanonicalLineReply({
      runtimeUserText: transcript,
      storedUserText: `[Voice] ${transcript}`,
      memoryUserText: transcript,
      displayReplyText: (replyText) => `🎙 "${transcript}"\n\n${replyText}`,
    });

    if (result?.replyText) {
      void sendVoiceReply(lineClient, lineUserId, result.replyText);
    }
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

    if (shouldExtractMemory) {
      const msgs = [...historyMessages, { role: 'user' as const, content: '[Video]' }, { role: 'assistant' as const, content: videoReplyText }];
      if (linkedUser) {
        void extractAndStoreMemory(linkedUser.userId, msgs, threadId, memoryContext);
      } else if (lineUserId) {
        void extractAndStoreLineUserMemory(lineUserId, msgs, threadId, memoryContext);
      }
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
  const userText = textMessage;

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

  // ⑥c Standard text → text response
  // Direct image generation request. This mirrors web chat's image route instead of
  // relying on the text model to decide whether to call the image tool.
  if (wantsImageGeneration(userText)) {
    try {
      const imageRun = await startCanonicalAgentImageGeneration({
        prompt: userText,
        userId: channel.userId,
        threadId,
        activeBrand,
        source: 'line',
      });

      const replyText = 'Image generation started. I will send the image here when it is ready.';
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
            parts: [{ type: 'text', text: replyText }],
            position: nextPosition + 1,
            createdAt: now,
          },
        ]),
        db.update(chatThread).set({ updatedAt: now }).where(eq(chatThread.id, threadId)),
      ]);

      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });

      void pollAndPushGeneratedLineImage({
        lineClient,
        to: groupId ?? lineUserId,
        userId: channel.userId,
        taskId: imageRun.taskId,
        generationId: imageRun.generationId,
      }).catch((err) => console.error('[LINE] direct image delivery failed:', err));

      recordMessageEvent(channel.id, lineUserId, {
        toolCallCount: 1,
        imagesSent: 0,
      }).catch((err) => console.warn('[LINE] recordMessageEvent failed:', err));
      return;
    } catch (err) {
      console.error('[LINE] direct image generation failed:', err);
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `Image generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }],
      });
      recordMessageEvent(channel.id, lineUserId).catch(() => {});
      return;
    }
  }

  await runCanonicalLineReply({
    runtimeUserText: userText,
  });
}
