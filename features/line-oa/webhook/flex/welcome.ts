import type {
  FlexBubble,
  FlexMessage,
  LineMessage,
  QuickReply,
  Sender,
} from '../types';
import { LINE_GREEN } from '../types';

/**
 * ④ Flex welcome bubble — shown when a user follows (adds) the LINE OA.
 *
 * Layout:
 *  [Brand logo hero]  (if logoUrl is available)
 *  👋 สวัสดีครับ! / Agent Name
 *  ─────────────────
 *  Welcome description text
 *  [แนะนำตัวเอง]     ← green primary CTA
 *  [ช่วยอะไรได้บ้าง?] ← secondary CTA
 *  + quick reply chips
 */
export function buildWelcomeFlex(
  agentName: string | undefined,
  logoUrl: string | undefined,
  sender: Sender | undefined,
  quickReply: QuickReply,
): LineMessage {
  const displayName = agentName ?? 'AI Assistant';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    ...(logoUrl
      ? {
          hero: {
            type: 'image',
            url: logoUrl,
            size: 'full',
            aspectRatio: '20:7',
            aspectMode: 'cover',
          },
        }
      : {}),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            { type: 'text', text: '👋', size: 'xxl', flex: 0 },
            {
              type: 'text',
              text: 'สวัสดีครับ!',
              weight: 'bold',
              size: 'xxl',
              color: LINE_GREEN,
              flex: 1,
              margin: 'sm',
              adjustMode: 'shrink-to-fit',
            },
          ],
        },
        {
          type: 'text',
          text: `ฉันคือ ${displayName}`,
          size: 'lg',
          weight: 'bold',
          color: '#333333',
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'text',
          text: 'ยินดีที่ได้รู้จักครับ 😊\nพิมพ์คำถามมาได้เลย หรือเลือกหัวข้อด้านล่างเพื่อเริ่มต้น',
          wrap: true,
          size: 'sm',
          color: '#555555',
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'แนะนำตัวเอง', text: 'แนะนำตัวเอง' },
          style: 'primary',
          color: LINE_GREEN,
          height: 'sm',
        },
        {
          type: 'button',
          action: { type: 'message', label: 'ช่วยอะไรได้บ้าง?', text: 'ช่วยอะไรได้บ้าง?' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  const flexMsg: FlexMessage = {
    type: 'flex',
    altText: `สวัสดีครับ! ฉันคือ ${displayName} — พิมพ์คำถามมาได้เลยครับ`,
    contents: bubble,
  };

  return {
    ...flexMsg,
    ...(sender ? { sender } : {}),
    quickReply,
  } as LineMessage;
}
