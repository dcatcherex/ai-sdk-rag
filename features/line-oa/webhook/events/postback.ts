import { and, eq } from 'drizzle-orm';
import type { messagingApi } from '@line/bot-sdk';

import { db } from '@/lib/db';
import { agent, lineAccountLink, lineUserAgentSession } from '@/db/schema';
import { resolveApprovalRequest } from '@/features/collaboration/service';
import { setUserRichMenu } from '../rich-menu';

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
