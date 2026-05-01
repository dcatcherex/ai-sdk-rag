import type { messagingApi } from '@line/bot-sdk';
import type { AgentRow, Sender } from '../types';
import { buildWelcomeFlex } from '../flex';
import { buildQuickReplyItem } from '../utils/quick-reply';
import { WELCOME_STICKERS, pickRandom } from '@/features/line-oa/utils/stickers';
import { getStarterTaskActions } from '@/features/agents/starter-tasks';

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
): Promise<void> {
  const starters = getStarterTaskActions(agentRow?.starterTasks, 3);
  const fallbackStarters = DEFAULT_STARTERS.map((text) => ({ title: text, prompt: text }));

  const quickReply = {
    items: (starters.length > 0 ? starters : fallbackStarters).map((starter) =>
      buildQuickReplyItem(starter.prompt, starter.title),
    ),
  };

  const welcomeMessage = buildWelcomeFlex(
    agentRow?.name ?? undefined,
    brandLogoUrl,
    sender,
    quickReply,
  );

  const welcomeSticker = pickRandom(WELCOME_STICKERS);

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      welcomeMessage,
      { type: 'sticker', packageId: welcomeSticker.packageId, stickerId: welcomeSticker.stickerId },
    ],
  });
}
