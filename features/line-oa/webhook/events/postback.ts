import { and, desc, eq } from 'drizzle-orm';
import type { messagingApi } from '@line/bot-sdk';

import { db } from '@/lib/db';
import { agent, chatMessage, chatThread, lineAccountLink, lineConversation, lineOaChannel, lineUserAgentSession } from '@/db/schema';
import { resolveApprovalRequest } from '@/features/collaboration/service';
import { runLogActivity } from '@/features/record-keeper/service';
import { buildResponsePlan } from '@/features/response-format';
import { renderResponseForLineFromCatalog } from '@/features/response-format/server/line-render';
import { setUserRichMenu } from '../rich-menu';
import { readPendingFarmRecordDraft } from './farm-records';

type PostbackEvent = {
  replyToken?: string;
  source?: { userId?: string };
  postback?: { data: string };
};

export async function handlePostbackEvent(
  event: PostbackEvent,
  lineClient: messagingApi.MessagingApiClient,
  channelId: string,
  channelAccessToken: string,
): Promise<void> {
  const data = event.postback?.data ?? '';
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  if (data.startsWith('switch_menu:')) {
    const lineMenuId = data.slice('switch_menu:'.length);
    if (lineMenuId) {
      await setUserRichMenu(lineUserId, lineMenuId, channelId, channelAccessToken);
    }
    return;
  }

  if (data.startsWith('workflow:human_review:request:')) {
    if (event.replyToken) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: 'รับคำขอให้เจ้าหน้าที่ช่วยตรวจสอบแล้ว หากช่องนี้มีผู้ดูแลที่ได้รับอนุญาต เขาจะติดตามเคสนี้ต่อให้ครับ',
        }],
      });
    }
    return;
  }

  if (data.startsWith('action=confirm_log')) {
    if (!event.replyToken) {
      return;
    }

    const [channel] = await db
      .select({ userId: lineOaChannel.userId })
      .from(lineOaChannel)
      .where(eq(lineOaChannel.id, channelId))
      .limit(1);

    const [conversation] = await db
      .select({ threadId: lineConversation.threadId })
      .from(lineConversation)
      .where(and(
        eq(lineConversation.channelId, channelId),
        eq(lineConversation.lineUserId, lineUserId),
      ))
      .limit(1);

    if (!channel || !conversation) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ไม่พบรายการที่รอยืนยันครับ กรุณาส่งรายละเอียดเพื่อบันทึกใหม่อีกครั้ง' }],
      });
      return;
    }

    const recentMessages = await db
      .select({
        role: chatMessage.role,
        metadata: chatMessage.metadata,
        position: chatMessage.position,
      })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, conversation.threadId))
      .orderBy(desc(chatMessage.position))
      .limit(20);

    const latestAssistant = recentMessages.find((row) => row.role === 'assistant');
    const pendingDraft = latestAssistant
      ? readPendingFarmRecordDraft(latestAssistant.metadata)
      : null;

    if (!pendingDraft) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: 'ไม่พบรายการที่รอยืนยันครับ กรุณาส่งรายละเอียดเพื่อบันทึกใหม่อีกครั้ง' }],
      });
      return;
    }

    const saved = await runLogActivity(
      {
        contextType: pendingDraft.contextType,
        category: pendingDraft.category,
        entity: pendingDraft.entity,
        date: pendingDraft.date,
        activity: pendingDraft.activity,
        quantity: pendingDraft.quantity,
        cost: pendingDraft.cost,
        income: pendingDraft.income,
        notes: pendingDraft.notes,
        metadata: pendingDraft.metadata,
      },
      channel.userId,
    );

    const saveText = [
      'บันทึกเรียบร้อยแล้วครับ',
      `กิจกรรม: ${saved.activity}`,
      `วันที่: ${saved.date}`,
    ].join('\n');
    const savePlan = buildResponsePlan({
      text: saveText,
      userText: 'ยืนยันบันทึกจากปุ่ม',
      locale: 'th-TH',
      toolResults: [
        {
          toolName: 'log_activity',
          result: {
            kind: 'record_saved',
            contextType: pendingDraft.contextType,
            activity: pendingDraft.activity,
            entity: pendingDraft.entity,
            date: saved.date,
            ...(pendingDraft.cost !== undefined ? { cost: String(pendingDraft.cost) } : {}),
            metadata: pendingDraft.metadata ?? { source: 'line' },
            recordId: saved.id,
          },
        },
      ],
      quickReplies: [
        { actionType: 'message', label: 'สรุปบันทึกสัปดาห์นี้', text: 'สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย' },
        { actionType: 'message', label: 'บันทึกรายการเพิ่ม', text: 'จะบันทึกรายการเพิ่ม' },
      ],
      metadata: {
        channel: 'line',
        source: 'line_record_confirmation_postback',
      },
    });

    const nextPosition = (recentMessages[0]?.position ?? -1) + 1;
    await Promise.all([
      db.insert(chatMessage).values([
        {
          id: crypto.randomUUID(),
          threadId: conversation.threadId,
          role: 'user',
          parts: [{ type: 'text', text: 'ยืนยันบันทึกจากปุ่ม' }],
          position: nextPosition,
          createdAt: new Date(),
        },
        {
          id: crypto.randomUUID(),
          threadId: conversation.threadId,
          role: 'assistant',
          parts: [{ type: 'text', text: saveText }],
          metadata: { responseFormat: savePlan.metadata },
          position: nextPosition + 1,
          createdAt: new Date(),
        },
      ]),
      db.update(chatThread).set({ updatedAt: new Date() }).where(eq(chatThread.id, conversation.threadId)),
    ]);

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: await renderResponseForLineFromCatalog(savePlan),
    });
    return;
  }

  const approvalAction =
    data.startsWith('approve_content:')
      ? ({ status: 'approved' as const, prefix: 'approve_content:' })
      : data.startsWith('reject_content:')
        ? ({ status: 'rejected' as const, prefix: 'reject_content:' })
        : data.startsWith('request_changes:')
          ? ({ status: 'changes_requested' as const, prefix: 'request_changes:' })
          : null;

  if (approvalAction) {
    const requestId = data.slice(approvalAction.prefix.length);
    const [linkRow] = await db
      .select({ userId: lineAccountLink.userId })
      .from(lineAccountLink)
      .where(and(eq(lineAccountLink.channelId, channelId), eq(lineAccountLink.lineUserId, lineUserId)))
      .limit(1);

    const resolverId = linkRow?.userId ?? lineUserId;

    let replyText: string;
    try {
      await resolveApprovalRequest(requestId, resolverId, { status: approvalAction.status });
      replyText =
        approvalAction.status === 'approved'
          ? 'อนุมัติเนื้อหาเรียบร้อยแล้ว'
          : approvalAction.status === 'rejected'
            ? 'ปฏิเสธเนื้อหาเรียบร้อยแล้ว'
            : 'ส่งกลับเพื่อแก้ไขและแจ้งผู้เขียนแล้ว';
    } catch (err) {
      console.error('[postback] resolveApprovalRequest failed:', err);
      replyText = `ไม่สามารถดำเนินการได้: ${(err as Error).message}`;
    }

    if (event.replyToken) {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
    }
    return;
  }

  if (data.startsWith('switch_agent:')) {
    const agentId = data.slice('switch_agent:'.length);
    const isDefault = agentId === 'default' || agentId === '';

    await db
      .insert(lineUserAgentSession)
      .values({
        id: crypto.randomUUID(),
        channelId,
        lineUserId,
        activeAgentId: isDefault ? null : agentId,
      })
      .onConflictDoUpdate({
        target: [lineUserAgentSession.channelId, lineUserAgentSession.lineUserId],
        set: { activeAgentId: isDefault ? null : agentId },
      });

    if (event.replyToken) {
      let confirmText = 'กลับไปใช้ผู้ช่วยหลักเรียบร้อยแล้ว';
      if (!isDefault) {
        const [agentRow] = await db
          .select({ name: agent.name })
          .from(agent)
          .where(eq(agent.id, agentId))
          .limit(1);
        if (agentRow?.name) {
          confirmText = `เปลี่ยนเป็น ${agentRow.name} แล้ว มีอะไรให้ช่วยไหมครับ?`;
        }
      }
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: confirmText }],
      });
    }
  }
}
