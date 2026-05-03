import type { messagingApi } from '@line/bot-sdk';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import {
  extractAndStoreLineUserMemory,
  extractAndStoreMemory,
} from '@/lib/memory';
import {
  buildFallbackResponsePlan,
  buildResponsePlan,
} from '@/features/response-format';
import { renderResponseForLineFromCatalog } from '@/features/response-format/server/line-render';
import { mergeResponseQuickReplies } from '@/features/response-format/workflow';
import { LINE_AGENT_RUN_POLICY } from '@/features/agents/server/channel-policies';
import { wantsImageGeneration } from '@/features/agents/server/media-intent';
import {
  prepareAgentRun,
  runAgentText,
  startCanonicalAgentImageGeneration,
} from '@/features/agents/server/run-service';
import { pollAndPushGeneratedLineImage, buildLineToolSet } from '../tools';
import { generateLineFollowUpSuggestions as generateFollowUpSuggestions } from '../utils/follow-up-suggestions';
import { stripMarkdown } from '../utils/markdown';
import type { AgentRow, LineMessage, LinkedUser, Sender } from '../types';
import type { ResolvedDomainContext } from '@/features/domain-profiles/types';
import type { Brand } from '@/features/brands/types';
import { handleFarmRecordMessage, readPendingFarmRecordDraft } from './farm-records';
import { runSummarizeRecords } from '@/features/record-keeper/service';
import {
  extractWeatherLocation,
  resolveLineAgricultureIntent,
  type IntentRouterMode,
} from './intent-router';
import { buildSuggestionQuickReplies, type ConversationHistoryMessage } from './reply-helpers';
import { wantsVideoGeneration, generateAndDeliverVideo } from './media-handlers';
import { FRIENDLY_STICKERS, pickRandom, shouldAddFriendlySticker } from '@/features/line-oa/utils/stickers';
import { recordMessageEvent } from '@/features/line-oa/analytics';
import { getForecastForLocation } from '@/lib/tools/weather';

type RunCanonicalLineReplyInput = {
  runtimeUserText: string;
  storedUserText?: string;
  memoryUserText?: string;
  displayReplyText?: (replyText: string) => string;
};

type RunCanonicalLineReplyContext = {
  agentRow: AgentRow;
  modelId: string;
  linkedUser?: LinkedUser;
  lineUserId: string;
  activeLineUserId: string;
  channel: { id: string; userId: string };
  threadId: string;
  historyMessages: ConversationHistoryMessage[];
  nextPosition: number;
  now: Date;
  memoryContext: string;
  lineExtraBlocks: string[];
  shouldExtractMemory: boolean;
  lineClient: messagingApi.MessagingApiClient;
  sender?: Sender;
  replyToken: string;
  followUpDomainHint?: string;
  followUpSkillHints?: string[];
};

type HandleTextMessageInput = {
  userText: string;
  latestPendingFarmRecordDraft: unknown;
  domainContext: ResolvedDomainContext | null;
  channel: { id: string; userId: string };
  threadId: string;
  nextPosition: number;
  now: Date;
  lineClient: messagingApi.MessagingApiClient;
  sender?: Sender;
  replyToken: string;
  modelId: string;
  agentRow: AgentRow;
  linkedUser?: LinkedUser;
  lineUserId: string;
  activeLineUserId: string;
  historyMessages: ConversationHistoryMessage[];
  memoryContext: string;
  lineExtraBlocks: string[];
  shouldExtractMemory: boolean;
  activeBrand?: Brand | null;
  groupId?: string;
  followUpSkillHints?: string[];
  displayUserText?: string;
  intentRouterMode?: string;
};

async function persistLineTurn(input: {
  threadId: string;
  nextPosition: number;
  now: Date;
  userText: string;
  assistantText: string;
}) {
  await Promise.all([
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'user',
        parts: [{ type: 'text', text: input.userText }],
        position: input.nextPosition,
        createdAt: input.now,
      },
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: input.assistantText }],
        position: input.nextPosition + 1,
        createdAt: input.now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: input.now }).where(eq(chatThread.id, input.threadId)),
  ]);
}

function extractLatestQuestion(text: string): string | undefined {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const question = [...lines].reverse().find((line) =>
    /[?？]$/.test(line)
    || /(ไหม|มั้ย|หรือยัง|หรือไม่|แบบไหน|แค่ไหน|อะไร|ที่ไหน|เมื่อไร)(ครับ|ค่ะ|คะ)?$/.test(line),
  );

  return question?.slice(0, 220);
}

function buildAssistantSuggestionContext(replyText: string): {
  text: string;
  latestQuestion?: string;
} {
  const latestQuestion = extractLatestQuestion(replyText);
  const intro = replyText.slice(0, 220);
  const outro = replyText.length > 220 ? replyText.slice(-360) : '';

  return {
    text: [
      intro,
      ...(outro ? [`assistant_tail: ${outro}`] : []),
      ...(latestQuestion ? [`assistant_latest_question: ${latestQuestion}`] : []),
    ].join('\n'),
    latestQuestion,
  };
}

function formatThaiWeatherRiskText(forecast: Awaited<ReturnType<typeof getForecastForLocation>>, userText: string): string {
  if (forecast.kind !== 'weather_forecast') {
    return forecast.message;
  }

  const firstDays = forecast.daily.slice(0, 3);
  const maxRainChance = Math.max(...forecast.daily.map((day) => day.precipitationProbabilityPercent));
  const maxRainMm = Math.max(...forecast.daily.map((day) => day.precipitationMm));
  const crop = userText.match(/(มะเขือเทศ|พริก|ข้าว|มันสำปะหลัง|ลำไย|ทุเรียน|แตงโม|ผัก|ข้าวโพด)/u)?.[1] ?? 'พืชในแปลง';
  const action = maxRainChance >= 60 || maxRainMm >= 20
    ? [
        'ตรวจทางระบายน้ำและลดน้ำขังในแปลง',
        `งดพ่นสารก่อนฝน และเฝ้าระวังโรคเชื้อราใน${crop}`,
        'ตรวจใบล่าง โคนต้น และจุดอับชื้นหลังฝนหยุด',
      ]
    : [
        'วางแผนรดน้ำช่วงเช้าหรือเย็น',
        `ตรวจความชื้นดินและอาการเหี่ยวของ${crop}`,
        'ใช้ช่วงฝนน้อยทำงานแปลงหรือพ่นสารตามฉลากหากจำเป็น',
      ];

  return [
    `ความเสี่ยงหลัก: ${forecast.riskSummary.headline}`,
    '',
    `พื้นที่: ${forecast.location.label}`,
    `ช่วงเวลา: 7 วันข้างหน้า`,
    `ตอนนี้: ${forecast.current.temperatureC}°C, ความชื้น ${forecast.current.humidityPercent}%, ฝน ${forecast.current.precipitationMm} มม.`,
    `โอกาสฝนสูงสุด: ${maxRainChance}%`,
    '',
    'แนวโน้ม 3 วันแรก:',
    ...firstDays.map((day) =>
      `- ${day.date}: สูงสุด ${day.temperatureMaxC}°C, ฝน ${day.precipitationProbabilityPercent}%, ${day.weatherDescription}`),
    '',
    'ควรทำทันที:',
    ...action.map((item) => `• ${item}`),
    '',
    `แหล่งข้อมูล: ${forecast.source}`,
  ].join('\n');
}

function formatFarmSummaryText(summary: Awaited<ReturnType<typeof runSummarizeRecords>>): string {
  if (summary.total === 0) {
    return 'ยังไม่มีบันทึกกิจกรรมในช่วงนี้ครับ';
  }

  const lines: string[] = [
    `สรุปสัปดาห์นี้:`,
    '',
    'งานที่ทำ:',
  ];

  for (const r of summary.records) {
    const parts: string[] = [`• ${r.activity}`];
    if (r.quantity) parts.push(`(${r.quantity})`);
    if (r.entity) parts.push(`ที่ ${r.entity}`);
    parts.push(`วันที่ ${r.date}`);
    lines.push(parts.join(' '));
  }

  lines.push('');
  lines.push(`ค่าใช้จ่ายหรือผลผลิตที่บันทึก:`);
  if (summary.totalCost > 0) {
    lines.push(`• ค่าใช้จ่ายรวม: ${summary.totalCost.toLocaleString('th-TH')} บาท`);
  }
  if (summary.totalIncome > 0) {
    lines.push(`• รายรับรวม: ${summary.totalIncome.toLocaleString('th-TH')} บาท`);
  }
  if (summary.totalCost === 0 && summary.totalIncome === 0) {
    lines.push(`• ยังไม่มีตัวเลขค่าใช้จ่ายหรือรายรับ`);
  }

  return lines.join('\n');
}

export async function runCanonicalLineReply(
  input: RunCanonicalLineReplyInput,
  context: RunCanonicalLineReplyContext,
): Promise<{ replyText: string } | null> {
  const prepared = await prepareAgentRun({
    identity: {
      channel: 'line',
      userId: context.linkedUser?.userId ?? null,
      billingUserId: context.channel.userId,
      lineUserId: context.lineUserId,
      isOwner: context.linkedUser?.userId === context.channel.userId,
    },
    threadId: context.threadId,
    agentId: context.agentRow?.id ?? null,
    model: context.modelId,
    messages: [...context.historyMessages, { role: 'user', content: input.runtimeUserText }],
    policy: LINE_AGENT_RUN_POLICY,
    channelContext: {
      memoryContext: context.memoryContext,
      lineChannelId: context.channel.id,
      extraBlocks: context.lineExtraBlocks,
    },
  });

  const mergedTools = buildLineToolSet({
    enabledToolIds: prepared.activeToolIds ?? [],
    userId: context.channel.userId,
    brandId: prepared.activeBrand?.id ?? undefined,
    lineUserId: context.activeLineUserId,
    channelId: context.channel.id,
    threadId: context.threadId,
    lineClient: context.lineClient,
  });

  const generateResult = await runAgentText({
    ...prepared,
    ...(prepared.supportsTools ? { tools: mergedTools } : {}),
  });

  const rawReplyText = generateResult.text;
  if (!rawReplyText) {
    return null;
  }

  const replyText = stripMarkdown(rawReplyText);
  const displayText = input.displayReplyText ? input.displayReplyText(replyText) : replyText;
  const storedUserText = input.storedUserText ?? input.runtimeUserText;
  const memoryUserText = input.memoryUserText ?? input.runtimeUserText;
  const assistantSuggestionContext = buildAssistantSuggestionContext(replyText);

  const contextStr = [
    ...context.historyMessages
      .slice(-4)
      .map((message) => `${message.role}: ${message.content.slice(0, 200)}`),
    `user: ${storedUserText.slice(0, 200)}`,
    `assistant: ${assistantSuggestionContext.text}`,
  ].join('\n');

  const [suggestions] = await Promise.all([
    generateFollowUpSuggestions(contextStr, {
      domainHint: context.followUpDomainHint,
      skillHints: context.followUpSkillHints,
      latestAssistantQuestion: assistantSuggestionContext.latestQuestion,
    }),
    persistLineTurn({
      threadId: context.threadId,
      nextPosition: context.nextPosition,
      now: context.now,
      userText: storedUserText,
      assistantText: replyText,
    }),
  ]);

  if (context.shouldExtractMemory) {
    const messagesForMemory = [
      ...context.historyMessages,
      { role: 'user' as const, content: memoryUserText },
      { role: 'assistant' as const, content: replyText },
    ];
    if (context.linkedUser) {
      void extractAndStoreMemory(
        context.linkedUser.userId,
        messagesForMemory,
        context.threadId,
        context.memoryContext,
      );
    } else if (context.lineUserId) {
      void extractAndStoreLineUserMemory(
        context.lineUserId,
        messagesForMemory,
        context.threadId,
        context.memoryContext,
      );
    }
  }

  const mergedQuickReplies = mergeResponseQuickReplies(
    generateResult.responsePlan?.quickReplies,
    buildSuggestionQuickReplies(suggestions),
  );

  const responsePlan = generateResult.responsePlan
    ? {
        ...generateResult.responsePlan,
        bodyText: displayText,
        quickReplies: mergedQuickReplies,
        formats: [
          ...generateResult.responsePlan.formats.filter((format) => format !== 'quick_replies'),
          ...(mergedQuickReplies.length > 0 ? ['quick_replies' as const] : []),
        ],
        metadata: {
          ...generateResult.responsePlan.metadata,
          channel: 'line',
        },
      }
    : buildFallbackResponsePlan({
        text: displayText,
        locale: 'th-TH',
        quickReplies: buildSuggestionQuickReplies(suggestions),
        metadata: {
          channel: 'line',
        },
      });

  const textMessages = await renderResponseForLineFromCatalog(responsePlan, { sender: context.sender });
  const imageMessages: LineMessage[] = generateResult.imageUrls
    .slice(0, Math.max(0, 4 - textMessages.length))
    .map((url) => ({
      type: 'image',
      originalContentUrl: url,
      previewImageUrl: url,
    }) as LineMessage);

  const stickerMessages: LineMessage[] = [];
  if (generateResult.imageUrls.length === 0 && shouldAddFriendlySticker(replyText)) {
    const sticker = pickRandom(FRIENDLY_STICKERS);
    stickerMessages.push({
      type: 'sticker',
      packageId: sticker.packageId,
      stickerId: sticker.stickerId,
    } as LineMessage);
  }

  const outgoingMessages = [...textMessages, ...imageMessages, ...stickerMessages];
  console.info('[LINE] Reply render', {
    formats: responsePlan.formats,
    templateKey: responsePlan.card?.templateKey ?? null,
    messageTypes: outgoingMessages.map((message) => message.type),
    hasFlex: outgoingMessages.some((message) => message.type === 'flex'),
  });

  await context.lineClient.replyMessage({
    replyToken: context.replyToken,
    messages: outgoingMessages,
  });

  recordMessageEvent(context.channel.id, context.activeLineUserId, {
    toolCallCount: generateResult.toolCallCount,
    imagesSent: imageMessages.length,
  }).catch((err) => console.warn('[LINE] recordMessageEvent failed:', err));

  return { replyText };
}

export async function handleTextMessage(input: HandleTextMessageInput): Promise<{ replyText: string } | null> {
  const runReply = (replyInput: RunCanonicalLineReplyInput) =>
    runCanonicalLineReply(replyInput, {
      agentRow: input.agentRow,
      modelId: input.modelId,
      linkedUser: input.linkedUser,
      lineUserId: input.lineUserId,
      activeLineUserId: input.activeLineUserId,
      channel: input.channel,
      threadId: input.threadId,
      historyMessages: input.historyMessages,
      nextPosition: input.nextPosition,
      now: input.now,
      memoryContext: input.memoryContext,
      lineExtraBlocks: input.lineExtraBlocks,
      shouldExtractMemory: input.shouldExtractMemory,
      lineClient: input.lineClient,
      sender: input.sender,
      replyToken: input.replyToken,
      followUpDomainHint: input.domainContext?.profile.domain,
      followUpSkillHints: input.followUpSkillHints,
    });

  const hasPendingFarmRecordDraft = Boolean(readPendingFarmRecordDraft(input.latestPendingFarmRecordDraft));
  const intentDecision = await resolveLineAgricultureIntent({
    text: input.userText,
    hasPendingFarmRecordDraft,
    domainContext: input.domainContext,
    modelId: input.modelId,
    mode: (input.intentRouterMode ?? 'ai_only') as IntentRouterMode,
    historyMessages: input.historyMessages,
  });

  console.info('[LINE] Agriculture intent decision', intentDecision);

  if (intentDecision.intent === 'weather_risk') {
    const location = extractWeatherLocation(input.userText, input.domainContext);
    if (!location) {
      const askLocationText = 'ต้องการเช็คสภาพอากาศพื้นที่ไหนครับ? ส่งชื่ออำเภอหรือจังหวัด เช่น "แม่ริม เชียงใหม่" แล้วผมจะเช็คพยากรณ์จริง 7 วันและสรุปความเสี่ยงให้';
      await persistLineTurn({
        threadId: input.threadId,
        nextPosition: input.nextPosition,
        now: input.now,
        userText: input.userText,
        assistantText: askLocationText,
      });
      await input.lineClient.replyMessage({
        replyToken: input.replyToken,
        messages: [
          ...(input.displayUserText
            ? [{ type: 'text' as const, text: input.displayUserText, ...(input.sender ? { sender: input.sender } : {}) }]
            : []),
          { type: 'text' as const, text: askLocationText, ...(input.sender ? { sender: input.sender } : {}) },
        ].slice(0, 5),
      });
      recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
      return { replyText: askLocationText };
    }

    const forecast = await getForecastForLocation(location);
    const weatherText = formatThaiWeatherRiskText(forecast, input.userText);
    const weatherPlan = buildResponsePlan({
      text: weatherText,
      userText: input.userText,
      locale: 'th-TH',
      toolResults: [
        {
          toolName: 'weather',
          result: forecast,
        },
      ],
      quickReplies: [
        { actionType: 'message', label: 'แนะนำงานแปลงต่อ', text: `${location} จากพยากรณ์นี้ควรจัดตารางงานแปลงอย่างไร` },
        { actionType: 'message', label: 'เช็คอีกพื้นที่', text: 'เช็คสภาพอากาศพื้นที่อื่น' },
      ],
      metadata: {
        channel: 'line',
        source: 'line_direct_weather',
      },
    });

    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: weatherText,
    });
    await input.lineClient.replyMessage({
      replyToken: input.replyToken,
      messages: [
        ...(input.displayUserText
          ? [{ type: 'text' as const, text: input.displayUserText, ...(input.sender ? { sender: input.sender } : {}) }]
          : []),
        ...(await renderResponseForLineFromCatalog(weatherPlan, { sender: input.sender })),
      ].slice(0, 5),
    });
    recordMessageEvent(input.channel.id, input.lineUserId, {
      toolCallCount: forecast.kind === 'weather_forecast' ? 1 : 0,
    }).catch(() => {});
    return { replyText: weatherText };
  }

  if (intentDecision.intent === 'farm_log_summary') {
    const summary = await runSummarizeRecords(
      { contextType: 'farm', period: 'week' },
      input.channel.userId,
    );
    const summaryText = formatFarmSummaryText(summary);
    const summaryPlan = buildResponsePlan({
      text: summaryText,
      userText: input.userText,
      locale: 'th-TH',
      toolResults: [{ toolName: 'summarize_records', result: summary }],
      quickReplies: [
        { actionType: 'message', label: 'บันทึกรายการเพิ่ม', text: 'จะบันทึกรายการเพิ่ม' },
        { actionType: 'message', label: 'เช็คอากาศ', text: 'เช็คสภาพอากาศและความเสี่ยงฟาร์ม 7 วัน' },
      ],
      metadata: { channel: 'line', source: 'line_farm_summary' },
    });
    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: summaryText,
    });
    await input.lineClient.replyMessage({
      replyToken: input.replyToken,
      messages: [
        ...(input.displayUserText
          ? [{ type: 'text' as const, text: input.displayUserText, ...(input.sender ? { sender: input.sender } : {}) }]
          : []),
        ...(await renderResponseForLineFromCatalog(summaryPlan, { sender: input.sender })),
      ].slice(0, 5),
    });
    recordMessageEvent(input.channel.id, input.lineUserId, { toolCallCount: 1 }).catch(() => {});
    return { replyText: summaryText };
  }

  if (
    intentDecision.intent === 'farm_log_create'
    || intentDecision.intent === 'confirm_pending'
    || intentDecision.intent === 'edit_pending'
    || intentDecision.intent === 'cancel_pending'
  ) {
    if (await handleFarmRecordMessage({
      userText: input.userText,
      pendingMetadata: input.latestPendingFarmRecordDraft,
      domainContext: input.domainContext,
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      channelUserId: input.channel.userId,
      replyToken: input.replyToken,
      lineClient: input.lineClient,
      sender: input.sender,
      displayUserText: input.displayUserText,
    })) {
      return null;
    }
  }

  if (wantsVideoGeneration(input.userText)) {
    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: '[Generating video...]',
    });

    await input.lineClient.replyMessage({
      replyToken: input.replyToken,
      messages: [{ type: 'text', text: 'กำลังสร้างวิดีโอ กรุณารอสักครู่ จะส่งให้เมื่อพร้อม' }],
    });

    void generateAndDeliverVideo(input.lineClient, input.lineUserId, input.userText);
    recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
    return { replyText: 'กำลังสร้างวิดีโอ กรุณารอสักครู่ จะส่งให้เมื่อพร้อม' };
  }

  if (wantsImageGeneration(input.userText)) {
    try {
      const imageRun = await startCanonicalAgentImageGeneration({
        prompt: input.userText,
        userId: input.channel.userId,
        threadId: input.threadId,
        activeBrand: input.activeBrand,
        source: 'line',
      });

      const replyText = 'Image generation started. I will send the image here when it is ready.';
      await persistLineTurn({
        threadId: input.threadId,
        nextPosition: input.nextPosition,
        now: input.now,
        userText: input.userText,
        assistantText: replyText,
      });

      await input.lineClient.replyMessage({
        replyToken: input.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });

      void pollAndPushGeneratedLineImage({
        lineClient: input.lineClient,
        to: input.groupId ?? input.lineUserId,
        userId: input.channel.userId,
        taskId: imageRun.taskId,
        generationId: imageRun.generationId,
      }).catch((err) => console.error('[LINE] direct image delivery failed:', err));

      recordMessageEvent(input.channel.id, input.lineUserId, {
        toolCallCount: 1,
        imagesSent: 0,
      }).catch((err) => console.warn('[LINE] recordMessageEvent failed:', err));
      return { replyText };
    } catch (err) {
      console.error('[LINE] direct image generation failed:', err);
      const errorText = `Image generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      await input.lineClient.replyMessage({
        replyToken: input.replyToken,
        messages: [{
          type: 'text',
          text: errorText,
        }],
      });
      recordMessageEvent(input.channel.id, input.lineUserId).catch(() => {});
      return { replyText: errorText };
    }
  }

  return await runReply({
    runtimeUserText: input.userText,
    ...(input.displayUserText
      ? { displayReplyText: (replyText: string) => `${input.displayUserText}\n\n${replyText}` }
      : {}),
  });
}
