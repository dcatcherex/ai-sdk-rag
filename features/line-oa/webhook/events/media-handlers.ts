import { generateImage, generateText } from 'ai';
import { messagingApi } from '@line/bot-sdk';
import { asc, eq } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { execFile as execFileCb } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

import { db } from '@/lib/db';
import { uploadPublicObject } from '@/lib/r2';
import { chatMessage, chatThread } from '@/db/schema';
import { chatModel } from '@/lib/ai';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import { modelSupportsCapability } from '@/features/chat/server/routing';
import {
  buildFallbackResponsePlan,
  renderResponseForLine,
} from '@/features/response-format';
import { CREDIT_PACKAGES } from '@/features/line-oa/payment/packages';
import {
  createPaymentOrder,
  hasPendingPaymentOrder,
  verifySlipAndCredit,
} from '@/features/line-oa/payment/service';
import {
  extractAndStoreLineUserMemory,
  extractAndStoreMemory,
} from '@/lib/memory';
import { recordMessageEvent } from '@/features/line-oa/analytics';
import { LINE_IMAGE_MODEL } from '../tools';
import { stripMarkdown } from '../utils/markdown';
import { generateLineFollowUpSuggestions as generateFollowUpSuggestions } from '../utils/follow-up-suggestions';
import type { LineMessage, LinkedUser, MessagePart, Sender } from '../types';
import { buildSuggestionQuickReplies, type ConversationHistoryMessage } from './reply-helpers';

const VOICE_SUMMARY_CHAR_THRESHOLD = 420;
const VOICE_SUMMARY_WORD_THRESHOLD = 90;
const MODEL_TRANSCRIBE = 'gemini-2.5-flash-lite';

function shouldUseVoiceSummary(text: string): boolean {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return text.length > VOICE_SUMMARY_CHAR_THRESHOLD || wordCount > VOICE_SUMMARY_WORD_THRESHOLD;
}

type LineChannel = {
  id: string;
  userId: string;
  channelAccessToken: string;
};

type CanonicalLineReply = (input: {
  runtimeUserText: string;
  storedUserText?: string;
  memoryUserText?: string;
  displayReplyText?: (replyText: string) => string;
}) => Promise<{ replyText: string } | null>;

type HandleImageMessageInput = {
  eventMessageId: string;
  channel: LineChannel;
  lineUserId: string;
  replyToken: string;
  lineClient: messagingApi.MessagingApiClient;
  sender?: Sender;
  modelId: string;
  runCanonicalLineReply: CanonicalLineReply;
  followUpDomainHint?: string;
  followUpSkillHints?: string[];
};

type HandleAudioMessageInput = {
  eventMessageId: string;
  channelAccessToken: string;
  lineUserId: string;
  replyToken: string;
  lineClient: messagingApi.MessagingApiClient;
  runCanonicalLineReply: CanonicalLineReply;
};

type HandleVideoMessageInput = {
  eventMessageId: string;
  channel: LineChannel;
  lineUserId: string;
  replyToken: string;
  lineClient: messagingApi.MessagingApiClient;
  sender?: Sender;
  modelId: string;
  lineSystemPrompt: string;
  historyMessages: ConversationHistoryMessage[];
  threadId: string;
  nextPosition: number;
  now: Date;
  shouldExtractMemory: boolean;
  linkedUser?: LinkedUser;
  memoryContext: string;
  followUpDomainHint?: string;
  followUpSkillHints?: string[];
};

type ClassifiedLineImageIntent = {
  kind: 'payment_slip' | 'domain_image' | 'generic_image';
  reason?: string;
};

function resolveVisionModel(modelId: string): string {
  return modelSupportsCapability(modelId, 'vision') ? modelId : chatModel;
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

async function transcodeWavToM4a(wavBuffer: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static path is unavailable');
  }

  await fs.access(ffmpegPath).catch(() => {
    throw new Error(`ffmpeg binary not found at path: ${ffmpegPath}`);
  });

  const execFile = promisify(execFileCb);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'line-tts-'));
  const inputPath = path.join(tempDir, 'input.wav');
  const outputPath = path.join(tempDir, 'output.m4a');

  try {
    await fs.writeFile(inputPath, wavBuffer);

    const args = [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-ac',
      '1',
      '-ar',
      '24000',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-movflags',
      '+faststart',
      outputPath,
    ];

    try {
      await execFile(ffmpegPath, args, { windowsHide: true });
    } catch (error) {
      const stderr =
        typeof error === 'object' && error !== null && 'stderr' in error
          ? String((error as { stderr?: unknown }).stderr ?? '')
          : '';
      throw new Error(`ffmpeg transcode failed. ${stderr.trim()}`.trim());
    }

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function transcribeLineAudio(messageId: string, channelAccessToken: string): Promise<string> {
  const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });
  const stream = await blobClient.getMessageContent(messageId);
  const audioBuffer = await streamToBuffer(stream as AsyncIterable<Uint8Array>);
  const base64 = audioBuffer.toString('base64');

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'audio/m4a', data: base64 } },
        {
          text: 'Transcribe this audio accurately, preserving the original language (including Thai). Return only the spoken words, nothing else.',
        },
      ],
    }],
  });

  return response.text?.trim() ?? '';
}

export function wantsVideoGeneration(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.startsWith('create video') ||
    lower.startsWith('generate video') ||
    lower.startsWith('make a video') ||
    lower.includes('video of ')
  ) {
    return true;
  }

  return (
    lower.includes('???????????') ||
    lower.includes('????????') ||
    lower.includes('?????????') ||
    lower.includes('??????') ||
    lower.includes('?????????')
  );
}

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
    const { url } = await uploadPublicObject({
      key,
      body: Buffer.from(base64, 'base64'),
      contentType: mediaType,
    });
    return url;
  } catch {
    return undefined;
  }
}

async function classifyLineImageIntent(input: {
  base64: string;
  hasPendingOrder: boolean;
  domainHint?: string;
  skillHints?: string[];
}): Promise<ClassifiedLineImageIntent> {
  try {
    const domainHint = input.domainHint?.trim();
    const skillHints = input.skillHints?.map((value) => value.trim()).filter((value) => value.length > 0).slice(0, 4) ?? [];
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: input.base64 } },
          {
            text: [
              'Classify this image for a LINE chatbot router.',
              'Return ONLY valid JSON with this shape:',
              '{"kind":"payment_slip"|"domain_image"|"generic_image","reason":"short explanation"}',
              '',
              'Choose "payment_slip" ONLY if the image clearly looks like a Thai payment slip, transfer receipt, banking screenshot, or similar payment proof.',
              'Choose "domain_image" for profession-specific working images such as plant/crop photos, medical photos, product photos, worksheets, or other domain task images.',
              'Choose "generic_image" for everything else.',
              `Pending payment order exists: ${input.hasPendingOrder ? 'yes' : 'no'}.`,
              ...(domainHint ? [`Active domain: ${domainHint}.`] : []),
              ...(skillHints.length > 0 ? [`Active skills/topics: ${skillHints.join(', ')}.`] : []),
              'Be conservative: if the image is a leaf/photo/object and not an obvious payment slip, do NOT choose payment_slip.',
            ].join('\n'),
          },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text?.trim() ?? '{}') as Partial<ClassifiedLineImageIntent>;
    if (parsed.kind === 'payment_slip' || parsed.kind === 'domain_image' || parsed.kind === 'generic_image') {
      return { kind: parsed.kind, ...(parsed.reason ? { reason: parsed.reason } : {}) };
    }
  } catch {
    // Fall through to safe default.
  }

  return { kind: 'domain_image', reason: 'Fallback to domain image handling.' };
}

async function detectPaymentSlip(base64: string): Promise<number | null> {
  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          {
            text: 'Is this a Thai PromptPay or bank transfer payment slip? Reply ONLY with valid JSON, no markdown: {"isSlip":true/false,"amountThb":number_or_null}',
          },
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

async function deriveImageObservation(
  base64: string,
  modelId: string,
  options?: { domainHint?: string; skillHints?: string[] },
): Promise<string> {
  const domainHint = options?.domainHint?.trim().toLowerCase();
  const skillHints = options?.skillHints?.filter((value) => value.trim().length > 0).slice(0, 4) ?? [];
  const isAgriculture = domainHint === 'agriculture'
    || skillHints.some((value) => /farm|crop|agri|pest|disease/i.test(value));

  const systemPrompt = isAgriculture
    ? [
        'You are preparing a concise visual observation for an agricultural assistant.',
        'Describe only what is visually observable in the image.',
        'Mention likely crop if visible, affected plant part, colors, spots, wilting, mold, insects, and spread pattern.',
        'Do not diagnose and do not recommend treatment.',
        'If uncertain, say what is unclear.',
        'Return plain text only in 2-4 short sentences.',
      ].join(' ')
    : [
        'You are preparing a concise visual observation for a domain-aware assistant.',
        'Describe only what is visibly present in the image.',
        ...(domainHint ? [`The active professional domain is ${domainHint}.`] : []),
        ...(skillHints.length > 0 ? [`Active topics: ${skillHints.join(', ')}.`] : []),
        'Mention the main subject, relevant visible details, damage/signs/labels/textures if present, and anything unclear.',
        'Do not infer hidden facts, diagnose, or recommend treatment.',
        'Return plain text only in 2-4 short sentences.',
      ].join(' ');

  const { text } = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: resolveVisionModel(modelId) as any,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [{ type: 'image', image: base64, mediaType: 'image/jpeg' }],
      },
    ],
  });

  return stripMarkdown(text ?? '').trim();
}

export async function generateAndDeliverVideo(
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
  prompt: string,
): Promise<void> {
  const apiKey = getKieApiKey();
  if (!apiKey) {
    return;
  }

  try {
    const [{ taskId }, previewUrl] = await Promise.all([
      KieService.createVeoTask(
        {
          prompt,
          model: 'veo3_fast',
          aspectRatio: '16:9',
          generationType: 'TEXT_2_VIDEO',
        },
        apiKey,
      ),
      generateVideoPreview(prompt),
    ]);

    const maxPolls = 48;
    const pollMs = 5000;
    for (let i = 0; i < maxPolls; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      const statusData = await KieService.getVeoTaskStatus(taskId, apiKey);

      if (statusData.code !== 200 || !statusData.data) {
        continue;
      }

      const { successFlag } = statusData.data;
      if (successFlag === 0) {
        continue;
      }

      if (successFlag === 2 || successFlag === 3) {
        await lineClient.pushMessage({
          to: lineUserId,
          messages: [{ type: 'text', text: '?????? ????????????????????? ????????????????????' }],
        });
        return;
      }

      if (successFlag === 1) {
        let videoUrl: string | undefined;
        const resultUrls = statusData.data.resultUrls as
          | string
          | Array<string | { url?: string }>
          | undefined;

        if (typeof resultUrls === 'string') {
          const parsed = JSON.parse(resultUrls) as string[] | { url?: string }[];
          videoUrl = Array.isArray(parsed)
            ? typeof parsed[0] === 'string'
              ? parsed[0]
              : parsed[0]?.url
            : undefined;
        } else if (Array.isArray(resultUrls)) {
          videoUrl = typeof resultUrls[0] === 'string' ? resultUrls[0] : resultUrls[0]?.url;
        }

        if (!videoUrl) {
          break;
        }

        await lineClient.pushMessage({
          to: lineUserId,
          messages: [{
            type: 'video',
            originalContentUrl: videoUrl,
            previewImageUrl: previewUrl ?? videoUrl,
          } as LineMessage],
        });
        return;
      }
    }

    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: '?????? ?????????????????????????????? ????????????' }],
    });
  } catch (err) {
    console.error('[LINE] Video generation failed:', err);
    await lineClient.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: '?????? ?????????????????????????????? ????????????' }],
    }).catch(() => {});
  }
}

async function sendVoiceReply(
  lineClient: messagingApi.MessagingApiClient,
  lineUserId: string,
  text: string,
): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    return;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let speechSourceText = text;

    if (shouldUseVoiceSummary(text)) {
      try {
        const summaryResponse = await genAI.models.generateContent({
          model: MODEL_TRANSCRIBE,
          contents: [{
            role: 'user',
            parts: [{
              text: [
                'Summarize this assistant response for voice playback.',
                'Requirements:',
                '- Keep the original language and tone (Thai if Thai, English if English).',
                '- Maximum 2 short sentences.',
                '- Keep key actionable points only.',
                '- Plain text only; no bullets, no markdown, no labels.',
                '',
                'Response:',
                text,
              ].join('\n'),
            }],
          }],
        });

        const summarized = summaryResponse.text?.trim();
        if (summarized) {
          speechSourceText = summarized;
          console.info('[LINE] Voice reply — using summarized audio script', {
            originalChars: text.length,
            summaryChars: summarized.length,
          });
        }
      } catch (summaryErr) {
        console.error('[LINE] Voice reply — summary generation failed, using original text:', summaryErr);
      }
    }

    const ttsText = speechSourceText.slice(0, 500);

    let response;
    try {
      response = await genAI.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: ttsText }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
        },
      });
    } catch (ttsErr) {
      console.error('[LINE] Voice reply — TTS generation failed:', ttsErr);
      return;
    }

    const pcmBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!pcmBase64) {
      console.warn('[LINE] Voice reply — TTS returned no audio data. candidates:', JSON.stringify(response.candidates?.map((c) => ({ finishReason: c.finishReason, parts: c.content?.parts?.map((p) => ({ type: Object.keys(p).join(',') })) }))));
      return;
    }

    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer);
    const durationMs = Math.round((pcmBuffer.length / (24000 * 2)) * 1000);
    let m4aBuffer: Buffer;

    try {
      m4aBuffer = await transcodeWavToM4a(wavBuffer);
    } catch (transcodeErr) {
      console.error('[LINE] Voice reply — m4a transcode failed:', {
        error: transcodeErr,
        ffmpegPath,
      });
      return;
    }

    const key = `line-audio/${crypto.randomUUID()}.m4a`;
    let url: string;
    try {
      ({ url } = await uploadPublicObject({
        key,
        body: m4aBuffer,
        contentType: 'audio/mp4',
      }));
    } catch (uploadErr) {
      console.error('[LINE] Voice reply — R2 upload failed:', uploadErr);
      return;
    }

    try {
      await lineClient.pushMessage({
        to: lineUserId,
        messages: [{ type: 'audio', originalContentUrl: url, duration: durationMs }],
      });
    } catch (pushErr) {
      console.error('[LINE] Voice reply — pushMessage failed:', {
        error: pushErr,
        audioUrl: url,
        durationMs,
      });
    }
  } catch (err) {
    console.error('[LINE] Voice reply — unexpected error:', err);
  }
}

export async function handleImageMessage(input: HandleImageMessageInput): Promise<boolean> {
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: input.channel.channelAccessToken,
  });
  const stream = await blobClient.getMessageContent(input.eventMessageId);
  const imageBuffer = await streamToBuffer(stream as AsyncIterable<Uint8Array>);
  const base64 = imageBuffer.toString('base64');

  const hasPendingOrder = await hasPendingPaymentOrder(input.lineUserId, input.channel.id);
  const imageIntent = await classifyLineImageIntent({
    base64,
    hasPendingOrder,
    domainHint: input.followUpDomainHint,
    skillHints: input.followUpSkillHints,
  });

  if (imageIntent.kind === 'payment_slip') {
    const detectedAmount = await detectPaymentSlip(base64);
    const slipResult = await verifySlipAndCredit(
      input.lineUserId,
      input.channel.id,
      base64,
      'image/jpeg',
    );

    if (slipResult.ok) {
      await input.lineClient.replyMessage({
        replyToken: input.replyToken,
        messages: [{
          type: 'text',
          text: [
            `??????????????`,
            `???????: ${slipResult.senderName}`,
            `???????????????: +${slipResult.credits.toLocaleString()} ??????`,
          ].join('\n'),
        }],
      });
      recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
      return true;
    }

    if (slipResult.error && hasPendingOrder) {
      await input.lineClient.replyMessage({
        replyToken: input.replyToken,
        messages: [{ type: 'text', text: `? ${slipResult.error}` }],
      });
      recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
      return true;
    }

    if (!hasPendingOrder && detectedAmount !== null) {
      const matchedPkg = CREDIT_PACKAGES.find((pkg) => Math.abs(pkg.amountThb - detectedAmount) < 1);
      if (matchedPkg) {
        const orderResult = await createPaymentOrder(input.lineUserId, input.channel.id, matchedPkg.id);
        if (orderResult.ok) {
          const autoVerifyResult = await verifySlipAndCredit(
            input.lineUserId,
            input.channel.id,
            base64,
            'image/jpeg',
          );
          if (autoVerifyResult.ok) {
            await input.lineClient.replyMessage({
              replyToken: input.replyToken,
              messages: [{
                type: 'text',
                text: [
                  `??????????????`,
                  `???????: ${autoVerifyResult.senderName}`,
                  `???????????????: +${autoVerifyResult.credits.toLocaleString()} ??????`,
                ].join('\n'),
              }],
            });
            recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
            return true;
          }
        }
      }
    }
  }

  const observation = await deriveImageObservation(base64, input.modelId, {
    domainHint: input.followUpDomainHint,
    skillHints: input.followUpSkillHints,
  });
  const runtimeUserText = [
    `[User sent ${input.followUpDomainHint ? `${input.followUpDomainHint} ` : ''}photo]`,
    observation
      ? `Observation: ${observation}`
      : 'Observation: Image received but the visual details were unclear.',
    input.followUpDomainHint === 'agriculture'
      ? 'Please help using the normal agriculture advisor workflow. Diagnose cautiously and ask only one short follow-up question if needed.'
      : 'Please help using the normal domain workflow. Use the visible image details and ask only one short follow-up question if needed.',
  ].join('\n');
  const storedUserText = [
    '[Image]',
    observation ? `Observation: ${observation}` : 'Observation: Unable to derive a clear observation.',
  ].join('\n');

  await input.runCanonicalLineReply({
    runtimeUserText,
    storedUserText,
    memoryUserText: runtimeUserText,
  });
  return true;
}

export async function handleAudioMessage(input: HandleAudioMessageInput): Promise<boolean> {
  const transcript = await transcribeLineAudio(input.eventMessageId, input.channelAccessToken);
  if (!transcript) {
    await input.lineClient.replyMessage({
      replyToken: input.replyToken,
      messages: [{ type: 'text', text: '?????? ???????????????????????????????? ???????????????????????' }],
    });
    return true;
  }

  const result = await input.runCanonicalLineReply({
    runtimeUserText: transcript,
    storedUserText: `[Voice] ${transcript}`,
    memoryUserText: transcript,
    displayReplyText: (replyText) => `?? "${transcript}"\n\n${replyText}`,
  });

  if (result?.replyText) {
    void sendVoiceReply(input.lineClient, input.lineUserId, result.replyText);
  }

  return true;
}

export async function handleVideoMessage(input: HandleVideoMessageInput): Promise<boolean> {
  const blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: input.channel.channelAccessToken,
  });
  const previewStream = await blobClient.getMessageContentPreview(input.eventMessageId);
  const previewBuffer = await streamToBuffer(previewStream as AsyncIterable<Uint8Array>);
  const previewBase64 = previewBuffer.toString('base64');

  const { text: rawVideoReply } = await generateText({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: resolveVisionModel(input.modelId) as any,
    system: `${input.lineSystemPrompt}\n\nThe user sent a video. You are seeing a preview frame from that video.`,
    messages: [
      ...input.historyMessages,
      {
        role: 'user' as const,
        content: [{ type: 'image' as const, image: previewBase64, mediaType: 'image/jpeg' }],
      },
    ],
  });

  if (!rawVideoReply) {
    return true;
  }

  const videoReplyText = stripMarkdown(rawVideoReply);
  const videoContextStr = `user: [sent a video]\nassistant: ${videoReplyText.slice(0, 200)}`;

  const [videoSuggestions] = await Promise.all([
    generateFollowUpSuggestions(videoContextStr, {
      domainHint: input.followUpDomainHint,
      skillHints: input.followUpSkillHints,
    }),
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'user',
        parts: [{ type: 'text', text: '[Video]' }],
        position: input.nextPosition,
        createdAt: input.now,
      },
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: videoReplyText }],
        position: input.nextPosition + 1,
        createdAt: input.now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: input.now }).where(eq(chatThread.id, input.threadId)),
  ]);

  if (input.shouldExtractMemory) {
    const messagesForMemory = [
      ...input.historyMessages,
      { role: 'user' as const, content: '[Video]' },
      { role: 'assistant' as const, content: videoReplyText },
    ];
    if (input.linkedUser) {
      void extractAndStoreMemory(
        input.linkedUser.userId,
        messagesForMemory,
        input.threadId,
        input.memoryContext,
      );
    } else if (input.lineUserId) {
      void extractAndStoreLineUserMemory(
        input.lineUserId,
        messagesForMemory,
        input.threadId,
        input.memoryContext,
      );
    }
  }

  const responsePlan = buildFallbackResponsePlan({
    text: videoReplyText,
    locale: 'th-TH',
    quickReplies: buildSuggestionQuickReplies(videoSuggestions),
    metadata: {
      channel: 'line',
    },
  });

  await input.lineClient.replyMessage({
    replyToken: input.replyToken,
    messages: renderResponseForLine(responsePlan, { sender: input.sender }),
  });
  recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
  return true;
}
