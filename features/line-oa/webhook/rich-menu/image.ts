import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import type { RichMenuAreaConfig } from '@/db/schema';

/**
 * Generate a PNG image for a rich menu.
 * Uses next/og (satori) to render each area at its exact pixel bounds.
 * Returns raw PNG bytes suitable for LINE's setRichMenuImage API.
 */
export async function generateRichMenuImage(areas: RichMenuAreaConfig[]): Promise<Buffer> {
  // Derive canvas size from area bounds; fall back to compact 2500×843
  const menuWidth = areas[0]?.bounds
    ? Math.max(...areas.map((a) => a.bounds!.x + a.bounds!.width))
    : 2500;
  const menuHeight = areas[0]?.bounds
    ? Math.max(...areas.map((a) => a.bounds!.y + a.bounds!.height))
    : 843;

  const hasBounds = areas.every((a) => a.bounds);

  const cells = hasBounds
    ? // Absolute-positioned cells using stored bounds
      areas.map((area, i) =>
        createElement(
          'div',
          {
            key: i,
            style: {
              position: 'absolute' as const,
              left: area.bounds!.x,
              top: area.bounds!.y,
              width: area.bounds!.width,
              height: area.bounds!.height,
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: area.bgColor || '#FFFFFF',
              borderRight: '3px solid rgba(0,0,0,0.08)',
              borderBottom: '3px solid rgba(0,0,0,0.08)',
              gap: 20,
            },
          },
          createElement('div', { style: { fontSize: 120, lineHeight: 1 } }, area.emoji || '💬'),
          createElement('div', {
            style: {
              fontSize: 52,
              fontWeight: 700,
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              textAlign: 'center' as const,
              padding: '0 16px',
            },
          }, area.label),
        ),
      )
    : // Fallback: equal-width columns
      areas.map((area, i) => {
        const count = areas.length;
        const colWidth = Math.floor(menuWidth / count);
        const w = i === count - 1 ? menuWidth - i * colWidth : colWidth;
        return createElement(
          'div',
          {
            key: i,
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              width: w,
              height: menuHeight,
              backgroundColor: area.bgColor || '#FFFFFF',
              borderRight: i < count - 1 ? '3px solid rgba(0,0,0,0.08)' : 'none',
              gap: 20,
            },
          },
          createElement('div', { style: { fontSize: 120, lineHeight: 1 } }, area.emoji || '💬'),
          createElement('div', {
            style: {
              fontSize: 52,
              fontWeight: 700,
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              textAlign: 'center' as const,
              padding: '0 16px',
            },
          }, area.label),
        );
      });

  const root = createElement(
    'div',
    {
      style: {
        position: 'relative' as const,
        display: 'flex',
        width: menuWidth,
        height: menuHeight,
        backgroundColor: '#F5F5F5',
      },
    },
    ...cells,
  );

  const response = new ImageResponse(root, { width: menuWidth, height: menuHeight });
  return Buffer.from(await response.arrayBuffer());
}
