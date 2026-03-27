import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import type { RichMenuAreaConfig } from './types';
import { RICH_MENU_HEIGHT, RICH_MENU_WIDTH } from './types';

/**
 * Generate a PNG image for a rich menu.
 * Uses next/og (satori) to render a grid of colored cells with emoji + label.
 * Returns raw PNG bytes suitable for LINE's setRichMenuImage API.
 */
export async function generateRichMenuImage(areas: RichMenuAreaConfig[]): Promise<Buffer> {
  const count = areas.length || 3;
  const colWidth = Math.floor(RICH_MENU_WIDTH / count);

  const cells = areas.map((area, i) =>
    createElement(
      'div',
      {
        key: i,
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          width: i === count - 1 ? RICH_MENU_WIDTH - i * colWidth : colWidth,
          height: RICH_MENU_HEIGHT,
          backgroundColor: area.bgColor || '#FFFFFF',
          borderRight: i < count - 1 ? '3px solid rgba(0,0,0,0.08)' : 'none',
          gap: 24,
        },
      },
      createElement('div', { style: { fontSize: 140, lineHeight: 1 } }, area.emoji || '💬'),
      createElement(
        'div',
        {
          style: {
            fontSize: 56,
            fontWeight: 700,
            color: '#FFFFFF',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            textAlign: 'center' as const,
            padding: '0 20px',
          },
        },
        area.label,
      ),
    ),
  );

  const root = createElement(
    'div',
    {
      style: {
        display: 'flex',
        width: RICH_MENU_WIDTH,
        height: RICH_MENU_HEIGHT,
        backgroundColor: '#FFFFFF',
      },
    },
    ...cells,
  );

  const response = new ImageResponse(root, {
    width: RICH_MENU_WIDTH,
    height: RICH_MENU_HEIGHT,
  });

  return Buffer.from(await response.arrayBuffer());
}
