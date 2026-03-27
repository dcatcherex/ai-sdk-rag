import type { messagingApi } from '@line/bot-sdk';
import type { RichMenuAreaConfig } from './types';
import { RICH_MENU_HEIGHT, RICH_MENU_WIDTH } from './types';

type RichMenuRequest = messagingApi.RichMenuRequest;

export function buildLineRichMenuPayload(
  areas: RichMenuAreaConfig[],
  chatBarText: string,
  name: string,
): RichMenuRequest {
  if (areas.length === 0) throw new Error('Rich menu must have at least 1 area');

  const count = areas.length;
  const colWidth = Math.floor(RICH_MENU_WIDTH / count);

  return {
    size: { width: RICH_MENU_WIDTH, height: RICH_MENU_HEIGHT },
    selected: true,
    name,
    chatBarText,
    areas: areas.map((area, i) => ({
      bounds: {
        x: i * colWidth,
        y: 0,
        width: i === count - 1 ? RICH_MENU_WIDTH - i * colWidth : colWidth, // last col takes remainder
        height: RICH_MENU_HEIGHT,
      },
      action: buildAreaAction(area),
    })),
  };
}

function buildAreaAction(area: RichMenuAreaConfig): messagingApi.Action {
  switch (area.action.type) {
    case 'message':
      return {
        type: 'message',
        label: area.label,
        text: area.action.text ?? area.label,
      };
    case 'uri':
      return {
        type: 'uri',
        label: area.label,
        uri: area.action.uri ?? 'https://line.me',
      };
    case 'postback':
      return {
        type: 'postback',
        label: area.label,
        data: area.action.data ?? '',
        displayText: area.action.displayText ?? area.label,
      };
    default:
      return {
        type: 'message',
        label: area.label,
        text: area.label,
      };
  }
}
