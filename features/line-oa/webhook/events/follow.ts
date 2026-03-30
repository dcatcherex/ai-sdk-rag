import type { messagingApi } from '@line/bot-sdk';
import type { AgentRow, Sender } from '../types';
import { buildWelcomeFlex } from '../flex';
import { buildQuickReplyItem } from '../utils/quick-reply';

type LineEvent = {
  replyToken: string;
};

/**
 * Handle the LINE 'follow' event (user adds the OA as a friend).
 * Sends a rich Flex welcome bubble with CTA buttons and quick replies.
 */
const DEFAULT_STARTERS = ['แนะนำตัวเอง', 'ช่วยอะไรได้บ้าง?', 'เริ่มต้นใช้งาน'];

export async function handleFollowEvent(
  event: LineEvent,
  lineClient: messagingApi.MessagingApiClient,
  agentRow: AgentRow,
  brandLogoUrl: string | undefined,
  sender: Sender | undefined,
  starterPrompts?: string[],
): Promise<void> {
  const starters = (starterPrompts && starterPrompts.length > 0)
    ? starterPrompts.slice(0, 3)
    : DEFAULT_STARTERS;

  const quickReply = {
    items: starters.map((s) => buildQuickReplyItem(s)),
  };

  const welcomeMessage = buildWelcomeFlex(
    agentRow?.name ?? undefined,
    brandLogoUrl,
    sender,
    quickReply,
  );

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [welcomeMessage],
  });
}
