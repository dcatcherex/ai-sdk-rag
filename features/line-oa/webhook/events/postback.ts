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

/**
 * Handle postback events.
 *
 * Supported data formats:
 *  - `switch_menu:<lineMenuId>`   — switch this user to a specific rich menu
 *  - `switch_agent:<agentId>`     — switch this user to a specific agent
 *  - `switch_agent:default`       — revert to channel default agent
 */
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

  // ── Approval actions ────────────────────────────────────────────────────────
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

    // Look up the app user id via lineAccountLink so we can record who resolved it
    const [linkRow] = await db
      .select({ userId: lineAccountLink.userId })
      .from(lineAccountLink)
      .where(and(eq(lineAccountLink.channelId, channelId), eq(lineAccountLink.lineUserId, lineUserId)))
      .limit(1);

    const resolverId = linkRow?.userId ?? lineUserId; // fallback to lineUserId (non-linked)

    let replyText: string;
    try {
      await resolveApprovalRequest(requestId, resolverId, { status: approvalAction.status });
      replyText =
        approvalAction.status === 'approved'
          ? '✅ Content approved successfully.'
          : approvalAction.status === 'rejected'
          ? '❌ Content has been rejected.'
          : '↩️ Changes requested. The author has been notified.';
    } catch (err) {
      console.error('[postback] resolveApprovalRequest failed:', err);
      replyText = `Could not process approval: ${(err as Error).message}`;
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

    // Upsert session row
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

    // Send confirmation if we have a reply token
    if (event.replyToken) {
      let confirmText = 'Switched back to the default assistant.';
      if (!isDefault) {
        const [agentRow] = await db
          .select({ name: agent.name })
          .from(agent)
          .where(and(eq(agent.id, agentId)))
          .limit(1);
        if (agentRow?.name) {
          confirmText = `Switched to ${agentRow.name}. How can I help you?`;
        }
      }
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: confirmText }],
      });
    }
  }
}
