import type { messagingApi } from '@line/bot-sdk';
import type { RichMenuAreaConfig } from '@/db/schema';

type RichMenuRequest = messagingApi.RichMenuRequest;

export function buildLineRichMenuPayload(
  areas: RichMenuAreaConfig[],
  chatBarText: string,
  name: string,
): RichMenuRequest {
  if (areas.length === 0) throw new Error('Rich menu must have at least 1 area');

  // Derive canvas size from bounds; fall back to compact 2500×843
  const hasBounds = areas.every((a) => a.bounds);
  const menuWidth = hasBounds
    ? Math.max(...areas.map((a) => a.bounds!.x + a.bounds!.width))
    : 2500;
  const menuHeight = hasBounds
    ? Math.max(...areas.map((a) => a.bounds!.y + a.bounds!.height))
    : 843;

  const count = areas.length;
  const colWidth = Math.floor(menuWidth / count);

  return {
    size: { width: menuWidth, height: menuHeight },
    selected: true,
    name,
    chatBarText,
    areas: areas.map((area, i) => ({
      bounds: area.bounds ?? {
        // Fallback: equal-width columns
        x: i * colWidth,
        y: 0,
        width: i === count - 1 ? menuWidth - i * colWidth : colWidth,
        height: menuHeight,
      },
      action: buildAreaAction(area),
    })),
  };
}

function buildAreaAction(area: RichMenuAreaConfig): messagingApi.Action {
  switch (area.action.type) {
    case 'message':
      return { type: 'message', label: area.label, text: area.action.text ?? area.label };
    case 'uri':
      return { type: 'uri', label: area.label, uri: area.action.uri ?? 'https://line.me' };
    case 'postback':
      return {
        type: 'postback',
        label: area.label,
        data: area.action.data ?? '',
        displayText: area.action.displayText ?? area.label,
      };
    case 'switch_agent':
      return {
        type: 'postback',
        label: area.label,
        data: `switch_agent:${area.action.agentId ?? ''}`,
        displayText: area.label,
      };
    default:
      return { type: 'message', label: area.label, text: area.label };
  }
}
