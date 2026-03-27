import type {
  FlexBubble,
  FlexComponent,
  FlexMessage,
  LineMessage,
  QuickReply,
  Sender,
} from '../types';
import { FLEX_BULLET_THRESHOLD, LINE_GREEN } from '../types';
import { splitIntoChunks } from '../utils/text';

/**
 * ⑤ Decide between Flex bubble (structured list) and plain text chunks.
 *
 * Uses Flex when the response has ≥ FLEX_BULLET_THRESHOLD bullet lines (•).
 * Plain short/paragraph responses stay as regular text messages.
 */
export function buildReplyMessages(
  text: string,
  sender: Sender | undefined,
  quickReply: QuickReply | undefined,
): LineMessage[] {
  const bulletLines = text.match(/^• .*/gm) ?? [];

  if (bulletLines.length >= FLEX_BULLET_THRESHOLD) {
    return [buildFlexReplyBubble(text, sender, quickReply)];
  }

  // Plain text: split into ≤4900-char chunks (LINE per-bubble limit)
  const chunks = splitIntoChunks(text, 4900);
  return chunks.map((chunk, i) => {
    const isLast = i === chunks.length - 1;
    return {
      type: 'text',
      text: chunk,
      ...(sender ? { sender } : {}),
      ...(isLast && quickReply ? { quickReply } : {}),
    } as LineMessage;
  });
}

/**
 * Render a structured AI response (with bullet points) as a Flex bubble.
 *
 * Parses the text into three zones:
 *  • intro  — paragraph(s) before the first bullet
 *  • bullets — the bullet items themselves (rendered with green ● dots)
 *  • outro  — paragraph(s) after the last bullet
 */
export function buildFlexReplyBubble(
  text: string,
  sender: Sender | undefined,
  quickReply: QuickReply | undefined,
): LineMessage {
  const lines = text.split('\n');

  const introLines: string[] = [];
  const bulletItems: string[] = [];
  const outroLines: string[] = [];
  let zone: 'intro' | 'bullets' | 'outro' = 'intro';

  for (const line of lines) {
    if (/^• /.test(line)) {
      zone = 'bullets';
      bulletItems.push(line.slice(2).trim());
    } else if (zone === 'bullets' && line.trim() === '') {
      outroLines.push('');
    } else if (zone === 'bullets') {
      zone = 'outro';
      if (line.trim()) outroLines.push(line);
    } else if (zone === 'intro') {
      introLines.push(line);
    } else {
      if (line.trim()) outroLines.push(line);
    }
  }

  const bodyContents: FlexComponent[] = [];

  const introText = introLines.join('\n').trim();
  if (introText) {
    bodyContents.push({
      type: 'text',
      text: introText,
      wrap: true,
      size: 'sm',
      color: '#333333',
    });
    bodyContents.push({ type: 'separator', margin: 'md', color: '#EEEEEE' });
  }

  for (const item of bulletItems) {
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          text: '●',
          size: 'xs',
          color: LINE_GREEN,
          flex: 0,
          offsetTop: '2px',
        },
        {
          type: 'text',
          text: item,
          wrap: true,
          size: 'sm',
          color: '#333333',
          flex: 1,
        },
      ],
    });
  }

  const outroText = outroLines.join('\n').trim();
  if (outroText) {
    bodyContents.push({ type: 'separator', margin: 'md', color: '#EEEEEE' });
    bodyContents.push({
      type: 'text',
      text: outroText,
      wrap: true,
      size: 'sm',
      color: '#555555',
      margin: 'md',
    });
  }

  const bubble: FlexBubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: bodyContents,
    },
  };

  const flexMsg: FlexMessage = {
    type: 'flex',
    altText: text.slice(0, 400),
    contents: bubble,
  };

  return {
    ...flexMsg,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
