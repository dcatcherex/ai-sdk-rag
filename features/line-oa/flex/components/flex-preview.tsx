'use client';

import { ExternalLinkIcon, AlertTriangleIcon } from 'lucide-react';
import { buildSimulatorUrl } from '../utils';

// ── Flex size → Tailwind width ─────────────────────────────────────────────
const BUBBLE_WIDTH: Record<string, string> = {
  nano: 'w-[120px]',
  micro: 'w-[160px]',
  deca: 'w-[240px]',
  hecto: 'w-[280px]',
  kilo: 'w-[300px]',
  mega: 'w-[320px]',
  giga: 'w-[320px]',
};

const TEXT_SIZE: Record<string, string> = {
  xxs: 'text-[9px]',
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
  xxl: 'text-xl',
  '3xl': 'text-2xl',
  '4xl': 'text-3xl',
  '5xl': 'text-4xl',
};

const ALIGN: Record<string, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

const LAYOUT: Record<string, string> = {
  vertical: 'flex flex-col',
  horizontal: 'flex flex-row flex-wrap',
  baseline: 'flex flex-row items-baseline flex-wrap',
};

const SPACING: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-0.5',
  sm: 'gap-1',
  md: 'gap-2',
  lg: 'gap-3',
  xl: 'gap-4',
  xxl: 'gap-6',
};

const PADDING: Record<string, string> = {
  none: 'p-0',
  xs: 'p-0.5',
  sm: 'p-1',
  md: 'p-2',
  lg: 'p-3',
  xl: 'p-4',
  xxl: 'p-6',
};

type FlexNode = Record<string, unknown>;

function getStr(obj: FlexNode, key: string, fallback = ''): string {
  return typeof obj[key] === 'string' ? (obj[key] as string) : fallback;
}

function getNum(obj: FlexNode, key: string, fallback = 0): number {
  return typeof obj[key] === 'number' ? (obj[key] as number) : fallback;
}

function FlexComponent({ node }: { node: FlexNode }) {
  const type = getStr(node, 'type');

  if (type === 'text') {
    const size = getStr(node, 'size', 'md');
    const weight = getStr(node, 'weight', 'regular');
    const align = getStr(node, 'align', 'start');
    const color = getStr(node, 'color', '#333333');
    const wrap = node.wrap === true;
    return (
      <span
        className={[
          TEXT_SIZE[size] ?? 'text-sm',
          weight === 'bold' ? 'font-bold' : 'font-normal',
          ALIGN[align] ?? 'text-left',
          wrap ? 'break-words whitespace-pre-wrap' : 'truncate',
          'leading-snug',
        ].join(' ')}
        style={{ color }}
      >
        {getStr(node, 'text')}
      </span>
    );
  }

  if (type === 'image') {
    const url = getStr(node, 'url');
    const aspectRatio = getStr(node, 'aspectRatio', '20:13');
    const [w, h] = aspectRatio.split(':').map(Number);
    const paddingBottom = h && w ? `${((h / w) * 100).toFixed(1)}%` : '65%';
    return (
      <div className="relative w-full overflow-hidden rounded" style={{ paddingBottom }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground">
            [image]
          </div>
        )}
      </div>
    );
  }

  if (type === 'button') {
    const label = getStr(node, 'action')
      ? getStr(node['action'] as FlexNode, 'label', 'Button')
      : 'Button';
    const style = getStr(node, 'style', 'secondary');
    const color = getStr(node, 'color', '');
    const bgColor = style === 'primary' ? (color || '#06C755') : 'transparent';
    const textColor = style === 'primary' ? '#FFFFFF' : (color || '#333333');
    const border = style === 'secondary' ? '1px solid #DDDDDD' : 'none';
    const height = getStr(node, 'height', 'md');
    return (
      <div
        className={[
          'flex items-center justify-center rounded text-center px-2 cursor-default',
          height === 'sm' ? 'py-1 text-xs' : 'py-2 text-sm',
        ].join(' ')}
        style={{ backgroundColor: bgColor, color: textColor, border, fontWeight: 600 }}
      >
        {label}
      </div>
    );
  }

  if (type === 'separator') {
    return <div className="border-t border-muted my-1" />;
  }

  if (type === 'box') {
    const layout = getStr(node, 'layout', 'vertical');
    const spacing = getStr(node, 'spacing', 'none');
    const paddingAll = getStr(node, 'paddingAll', '');
    const backgroundColor = getStr(node, 'backgroundColor', '');
    const cornerRadius = getStr(node, 'cornerRadius', '');
    const flex = getNum(node, 'flex', 0);
    const contents = Array.isArray(node.contents) ? (node.contents as FlexNode[]) : [];

    const paddingCls = paddingAll ? '' : '';
    const paddingStyle = paddingAll
      ? { padding: paddingAll }
      : undefined;

    return (
      <div
        className={[
          LAYOUT[layout] ?? 'flex flex-col',
          SPACING[spacing] ?? 'gap-0',
          paddingCls,
        ].join(' ')}
        style={{
          flex: flex || undefined,
          backgroundColor: backgroundColor || undefined,
          borderRadius: cornerRadius || undefined,
          ...paddingStyle,
        }}
      >
        {contents.map((child, i) => (
          <FlexComponent key={i} node={child} />
        ))}
      </div>
    );
  }

  return null;
}

function FlexBubble({ bubble }: { bubble: FlexNode }) {
  const size = getStr(bubble, 'size', 'mega');
  const widthCls = BUBBLE_WIDTH[size] ?? 'w-[320px]';

  const header = bubble.header as FlexNode | undefined;
  const hero = bubble.hero as FlexNode | undefined;
  const body = bubble.body as FlexNode | undefined;
  const footer = bubble.footer as FlexNode | undefined;

  return (
    <div
      className={`${widthCls} rounded-xl overflow-hidden border border-muted bg-white shadow-sm flex flex-col`}
    >
      {header && (
        <div style={{ backgroundColor: getStr(header, 'backgroundColor', '') }}>
          <FlexComponent node={header} />
        </div>
      )}
      {hero && <FlexComponent node={hero} />}
      {body && (
        <div className="flex-1">
          <FlexComponent node={body} />
        </div>
      )}
      {footer && (
        <div style={{ backgroundColor: getStr(footer, 'backgroundColor', '#F8F8F8') }}>
          <FlexComponent node={footer} />
        </div>
      )}
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

type FlexPreviewProps = {
  payload: Record<string, unknown> | null;
};

export function FlexPreview({ payload }: FlexPreviewProps) {
  if (!payload) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Paste valid Flex JSON to see preview
      </div>
    );
  }

  const type = typeof payload.type === 'string' ? payload.type : '';

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-auto flex items-start justify-center pt-4 px-2">
        {type === 'bubble' && <FlexBubble bubble={payload} />}
        {type === 'carousel' && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(Array.isArray(payload.contents) ? payload.contents as FlexNode[] : []).map(
              (bubble, i) => <FlexBubble key={i} bubble={bubble} />,
            )}
          </div>
        )}
        {type !== 'bubble' && type !== 'carousel' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangleIcon className="size-4" />
            Unsupported type: {type || '(missing)'}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <AlertTriangleIcon className="size-3" />
          Approximate preview
        </span>
        <a
          href={buildSimulatorUrl(payload)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          Open in LINE Simulator
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    </div>
  );
}
