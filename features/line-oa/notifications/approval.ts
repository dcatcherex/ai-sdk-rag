/**
 * LINE push notifications for the approval workflow.
 *
 * These functions are called fire-and-forget from the collaboration service —
 * they must never throw in a way that breaks the main flow.
 */

import { messagingApi } from '@line/bot-sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { lineAccountLink, lineOaChannel } from '@/db/schema';
import type { ApprovalRequest } from '@/features/collaboration/types';

type ChannelTokenRow = { channelAccessToken: string; lineUserId: string };

/** Find all LINE channels + user IDs for a given app userId */
async function getLinkedChannels(userId: string): Promise<ChannelTokenRow[]> {
  const rows = await db
    .select({
      channelAccessToken: lineOaChannel.channelAccessToken,
      lineUserId: lineAccountLink.lineUserId,
    })
    .from(lineAccountLink)
    .innerJoin(lineOaChannel, eq(lineAccountLink.channelId, lineOaChannel.id))
    .where(eq(lineAccountLink.userId, userId));

  return rows;
}

/**
 * Notify the assignee via LINE that they have a new approval request.
 * Sends a text message + quick-reply buttons (Approve / Request Changes / Reject).
 */
export async function notifyAssigneeViaLine(
  assigneeId: string,
  request: ApprovalRequest,
  contentTitle: string,
): Promise<void> {
  const channels = await getLinkedChannels(assigneeId);
  if (channels.length === 0) return;

  const preview = contentTitle.slice(0, 60);
  const dueText = request.dueAt
    ? `\nDue: ${new Date(request.dueAt).toLocaleDateString()}`
    : '';
  const text =
    `📋 New approval request\n\n"${preview}"${dueText}\n\nPlease review and respond:`;

  const quickReply: messagingApi.QuickReply = {
    items: [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '✅ Approve',
          data: `approve_content:${request.id}`,
          displayText: 'Approve',
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '↩️ Changes',
          data: `request_changes:${request.id}`,
          displayText: 'Request changes',
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: '❌ Reject',
          data: `reject_content:${request.id}`,
          displayText: 'Reject',
        },
      },
    ],
  };

  await Promise.allSettled(
    channels.map(({ channelAccessToken, lineUserId }) => {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken });
      return client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text, quickReply }],
      });
    }),
  );
}

/**
 * Notify the requester via LINE about the resolution of their approval request.
 */
export async function notifyRequesterViaLine(
  requesterId: string,
  resolution: { status: 'approved' | 'rejected' | 'changes_requested'; note?: string | null },
  contentTitle: string,
): Promise<void> {
  const channels = await getLinkedChannels(requesterId);
  if (channels.length === 0) return;

  const preview = contentTitle.slice(0, 60);
  const statusText =
    resolution.status === 'approved'
      ? '✅ approved'
      : resolution.status === 'rejected'
      ? '❌ rejected'
      : '↩️ returned for changes';

  const noteText = resolution.note ? `\n\nNote: ${resolution.note}` : '';
  const text = `Your content "${preview}" has been ${statusText}.${noteText}`;

  await Promise.allSettled(
    channels.map(({ channelAccessToken, lineUserId }) => {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken });
      return client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text }],
      });
    }),
  );
}
