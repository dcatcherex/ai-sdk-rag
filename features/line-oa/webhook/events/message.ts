import { asc, eq } from 'drizzle-orm';
import { messagingApi } from '@line/bot-sdk';

import { db } from '@/lib/db';
import { chatMessage, userPreferences } from '@/db/schema';
import {
  getLineUserMemoryContext,
  getUserMemoryContext,
  resolveMemoryPreferences,
} from '@/lib/memory';
import { SIGNUP_BONUS_CREDITS } from '@/lib/credits';
import { wantsImageGeneration } from '@/features/agents/server/media-intent';
import {
  buildAgentRunSystemPrompt,
  EMPTY_SKILL_RUNTIME,
  resolveAgentBrandRuntime,
} from '@/features/agents/server/runtime';
import { resolveRelevantDomainContext } from '@/features/domain-profiles/service';
import { renderDomainContextPromptBlock } from '@/features/domain-profiles/server/prompt';
import { buildDomainSetupPromptBlock } from '@/features/domain-profiles/server/setup';
import { consumeLinkToken, registerLineUser } from '@/features/line-oa/link/service';
import { createPaymentOrder, sendPaymentQr } from '@/features/line-oa/payment/service';
import { CREDIT_PACKAGES, formatPackageMenu } from '@/features/line-oa/payment/packages';
import type { SkillRuntimeContext } from '@/features/skills/server/activation';

import { getOrCreateConversation } from '../db';
import type { AgentRow, LinkedUser, MessagePart, Sender } from '../types';
import { MAX_CONTEXT_MESSAGES } from '../types';
import { extractTextContent } from '../utils/text';
import { handleAudioMessage, handleImageMessage, handleVideoMessage } from './media-handlers';
import { handleTextMessage, runCanonicalLineReply } from './text-replies';

export { wantsImageGeneration };

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
  if (!event.replyToken) {
    return;
  }

  const replyToken = event.replyToken;
  const msgType = event.message?.type;
  if (msgType !== 'text' && msgType !== 'image' && msgType !== 'audio' && msgType !== 'video') {
    return;
  }

  const textMessage = msgType === 'text' ? event.message?.text?.trim() ?? '' : '';
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return;
  }

  const activeLineUserId = lineUserId;

  if (msgType === 'text') {
    const userText = event.message?.text?.trim() ?? '';
    if (await handleTextCommand({ userText, lineUserId, channel, replyToken, lineClient })) return;
  }

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
    .select({ role: chatMessage.role, parts: chatMessage.parts, metadata: chatMessage.metadata })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position))
    .limit(MAX_CONTEXT_MESSAGES);

  const historyMessages = historyRows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: extractTextContent(row.parts as MessagePart[]),
    }))
    .filter((message) => message.content.length > 0);

  const latestPendingFarmRecordDraft = [...historyRows]
    .reverse()
    .find((row) => row.role === 'assistant')?.metadata;

  const {
    memoryContext,
    shouldExtractMemory,
    lineSystemPrompt,
    activeBrand,
    domainContext,
    lineExtraBlocks,
    followUpSkillHints,
  } = await buildLineAgentContext({
    channel,
    lineUserId,
    linkedUser,
    groupId,
    textMessage,
    agentRow,
    systemPrompt,
    skillRuntime,
  });

  const now = new Date();
  const nextPosition = historyRows.length;

  const runLineReply = (input: {
    runtimeUserText: string;
    storedUserText?: string;
    memoryUserText?: string;
    displayReplyText?: (replyText: string) => string;
  }) =>
    runCanonicalLineReply(input, {
      agentRow,
      modelId,
      linkedUser,
      lineUserId,
      activeLineUserId,
      channel: { id: channel.id, userId: channel.userId },
      threadId,
      historyMessages,
      nextPosition,
      now,
      memoryContext,
      lineExtraBlocks,
      shouldExtractMemory,
      lineClient,
      sender,
      replyToken,
      followUpDomainHint: domainContext?.profile.domain,
      followUpSkillHints,
    });

  if (msgType === 'image') {
    await handleImageMessage({
      eventMessageId: event.message!.id,
      channel: {
        id: channel.id,
        userId: channel.userId,
        channelAccessToken: channel.channelAccessToken,
      },
      lineUserId,
      replyToken,
      lineClient,
      sender,
      modelId,
      runCanonicalLineReply: runLineReply,
      followUpDomainHint: domainContext?.profile.domain,
      followUpSkillHints,
    });
    return;
  }

  if (msgType === 'audio') {
    await handleAudioMessage({
      eventMessageId: event.message!.id,
      channelAccessToken: channel.channelAccessToken,
      lineUserId,
      replyToId: groupId ?? lineUserId,
      replyToken,
      lineClient,
      runCanonicalLineReply: runLineReply,
      tryHandleTranscript: async (transcript) => {
        const result = await handleTextMessage({
          userText: transcript,
          latestPendingFarmRecordDraft,
          domainContext,
          channel: { id: channel.id, userId: channel.userId },
          threadId,
          nextPosition,
          now,
          lineClient,
          sender,
          replyToken,
          modelId,
          agentRow,
          linkedUser,
          lineUserId,
          activeLineUserId,
          historyMessages,
          memoryContext,
          lineExtraBlocks,
          shouldExtractMemory,
          activeBrand,
          groupId,
          followUpSkillHints,
          displayUserText: `🎙️ ได้ยินว่า: "${transcript}"`,
        });
        return { handled: true, replyText: result?.replyText };
      },
    });
    return;
  }

  if (msgType === 'video') {
    await handleVideoMessage({
      eventMessageId: event.message!.id,
      channel: {
        id: channel.id,
        userId: channel.userId,
        channelAccessToken: channel.channelAccessToken,
      },
      lineUserId,
      replyToken,
      lineClient,
      sender,
      modelId,
      lineSystemPrompt,
      historyMessages,
      threadId,
      nextPosition,
      now,
      shouldExtractMemory,
      linkedUser,
      memoryContext,
      followUpDomainHint: domainContext?.profile.domain,
      followUpSkillHints,
    });
    return;
  }

  await handleTextMessage({
    userText: textMessage,
    latestPendingFarmRecordDraft,
    domainContext,
    channel: { id: channel.id, userId: channel.userId },
    threadId,
    nextPosition,
    now,
    lineClient,
    sender,
    replyToken,
    modelId,
    agentRow,
    linkedUser,
    lineUserId,
    activeLineUserId,
    historyMessages,
    memoryContext,
    lineExtraBlocks,
    shouldExtractMemory,
    activeBrand,
    groupId,
    followUpSkillHints,
  });
}

// ─── Private helpers ─────────────────────────────────────────────────────────

async function handleTextCommand(input: {
  userText: string;
  lineUserId: string;
  channel: ChannelInfo;
  replyToken: string;
  lineClient: messagingApi.MessagingApiClient;
}): Promise<boolean> {
  const { userText, lineUserId, channel, replyToken, lineClient } = input;

  if (!userText) return false;

  const linkMatch = userText.match(/^\/link\s+([A-Z2-9]{8})$/i);
  if (linkMatch) {
    const token = linkMatch[1]!.toUpperCase();
    const result = await consumeLinkToken(token, lineUserId, channel.id, lineClient);
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: result.message }],
    });
    return true;
  }

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
      if (channel.memberRichMenuLineId) {
        void lineClient.linkRichMenuIdToUser(lineUserId, channel.memberRichMenuLineId);
      }
    }
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: replyText }],
    });
    return true;
  }

  const isTopupCommand =
    userText === 'เติมเครดิต' ||
    userText === 'เติมเงิน' ||
    userText.toLowerCase() === '/topup' ||
    userText.toLowerCase() === 'topup';

  if (isTopupCommand) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: formatPackageMenu() }],
    });
    return true;
  }

  const packageChoice = /^[1-4]$/.test(userText) ? Number.parseInt(userText, 10) : 0;
  if (packageChoice >= 1 && packageChoice <= 4) {
    const pkg = CREDIT_PACKAGES[packageChoice - 1]!;
    const result = await createPaymentOrder(lineUserId, channel.id, pkg.id);
    if (!result.ok) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{ type: 'text', text: result.error }],
      });
      return true;
    }
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: `กำลังสร้าง QR Code สำหรับ ${pkg.label} กรุณารอสักครู่...` }],
    });
    void sendPaymentQr(lineClient, lineUserId, pkg, result.qrDataUrl, result.orderId);
    return true;
  }

  return false;
}

async function buildLineAgentContext(input: {
  channel: ChannelInfo;
  lineUserId: string;
  linkedUser: LinkedUser | undefined;
  groupId: string | undefined;
  textMessage: string;
  agentRow: AgentRow;
  systemPrompt: string;
  skillRuntime: SkillRuntimeContext;
}) {
  const { channel, lineUserId, linkedUser, groupId, textMessage, agentRow, systemPrompt, skillRuntime } = input;

  let memoryContext = '';
  let shouldExtractMemory = false;
  if (linkedUser) {
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
  } else {
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
    { profileLimit: 10, entityLimit: 8 },
    linkedUser?.userId
      ? { userId: linkedUser.userId }
      : { lineUserId, channelId: channel.id },
  );
  const domainContextBlock = renderDomainContextPromptBlock(domainContext);
  const domainSetupBlock = buildDomainSetupPromptBlock({
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

  const lineExtraBlocks = groupId
    ? [
        `\n\n<line_group_context>\nYou are in a LINE group chat shared by multiple users. Keep replies concise and relevant to the whole group.${linkedUser?.displayName ? ` The member who sent this message is ${linkedUser.displayName}.` : ''}\n</line_group_context>`,
      ]
    : linkedUser?.displayName
      ? [
          `\n\n<line_user_context>\nThe user you are talking to is named ${linkedUser.displayName}. Address them by name naturally when appropriate.\n</line_user_context>`,
        ]
      : [];

  const followUpSkillHints = skillRuntime.activatedSkills
    .map((entry) => entry.skill.name.trim())
    .filter((name) => name.length > 0)
    .slice(0, 4);

  return { memoryContext, shouldExtractMemory, lineSystemPrompt, activeBrand, domainContext, lineExtraBlocks, followUpSkillHints };
}
