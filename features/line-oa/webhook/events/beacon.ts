import { and, eq } from 'drizzle-orm';
import type { messagingApi } from '@line/bot-sdk';
import { db } from '@/lib/db';
import { lineBeaconDevice } from '@/db/schema';
import type { Sender } from '../types';

type BeaconEvent = {
  replyToken?: string;
  source?: { type: string; userId?: string };
  beacon?: { hwid: string; type: string };
};

type ChannelInfo = { id: string; channelAccessToken: string };

/**
 * Handle LINE beacon events.
 * Currently handles 'enter' events — pushes the device's configured enter message
 * (or a generic proximity greeting) when a user walks into beacon range.
 * 'leave' events are acknowledged but produce no reply.
 */
export async function handleBeaconEvent(
  event: BeaconEvent,
  lineClient: messagingApi.MessagingApiClient,
  channel: ChannelInfo,
  sender: Sender | undefined,
): Promise<void> {
  const beaconType = event.beacon?.type;
  if (beaconType !== 'enter' && beaconType !== 'banner.click') return;

  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const hwid = event.beacon!.hwid;

  // Look up registered beacon device for this channel
  const deviceRows = await db
    .select({ enterMessage: lineBeaconDevice.enterMessage, name: lineBeaconDevice.name })
    .from(lineBeaconDevice)
    .where(and(eq(lineBeaconDevice.channelId, channel.id), eq(lineBeaconDevice.hwid, hwid)))
    .limit(1);

  const device = deviceRows[0];
  const message = device?.enterMessage
    ?? (device?.name ? `ยินดีต้อนรับสู่ ${device.name}! 👋 มีอะไรให้ช่วยไหม?` : 'ยินดีต้อนรับ! 👋 มีอะไรให้ช่วยไหม?');

  await lineClient.pushMessage({
    to: lineUserId,
    messages: [
      {
        type: 'text',
        text: message,
        ...(sender ? { sender } : {}),
      },
    ],
  });
}
