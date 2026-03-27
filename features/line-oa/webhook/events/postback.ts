import type { messagingApi } from '@line/bot-sdk';
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
 *  - `switch_menu:<lineMenuId>` — switch this user to a specific rich menu
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
  }
}
