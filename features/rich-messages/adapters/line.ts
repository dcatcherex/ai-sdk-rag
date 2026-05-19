import type { FlexBubble, FlexComponent, FlexMessage } from '@/features/line-oa/webhook/types';
import type { RichMessageAction, RichMessageInstance, RichMessageTone } from '@/features/rich-messages/types';

function toneToLineColor(tone: RichMessageTone | undefined): string {
  switch (tone) {
    case 'success':
      return '#2E7D32';
    case 'warning':
      return '#F57C00';
    case 'danger':
      return '#C62828';
    case 'info':
      return '#1565C0';
    default:
      return '#374151';
  }
}

function buildSectionComponent(section: {
  label: string;
  value: string;
  color: string;
}): FlexComponent {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      {
        type: 'text',
        text: section.label,
        size: 'xs',
        weight: 'bold',
        color: '#6B7280',
      },
      {
        type: 'text',
        text: section.value,
        wrap: true,
        size: 'sm',
        color: section.color,
      },
    ],
  } as FlexComponent;
}

function actionStyleToLineStyle(action: RichMessageAction): 'primary' | 'secondary' {
  return action.style === 'primary' ? 'primary' : 'secondary';
}

function actionStyleToColor(action: RichMessageAction): string | undefined {
  if (action.style === 'danger') return '#C62828';
  if (action.style === 'primary') return '#2E7D32';
  return undefined;
}

function buildActionComponent(action: RichMessageAction): FlexComponent | null {
  if (!action.label.trim() || !action.value.trim()) return null;

  const baseAction = (() => {
    switch (action.kind) {
      case 'message':
        return { type: 'message' as const, label: action.label, text: action.value };
      case 'postback':
        return { type: 'postback' as const, label: action.label, data: action.value, displayText: action.label };
      case 'uri':
        return { type: 'uri' as const, label: action.label, uri: action.value };
      default:
        return null;
    }
  })();

  if (!baseAction) return null;

  return {
    type: 'button',
    style: actionStyleToLineStyle(action),
    height: 'sm',
    ...(actionStyleToColor(action) ? { color: actionStyleToColor(action) } : {}),
    action: baseAction,
  } as FlexComponent;
}

export function renderRichMessageForLine(instance: RichMessageInstance): FlexMessage {
  const layout = instance.resolvedLayout;
  const headerColor = toneToLineColor(layout.tone);
  const bodyContents: FlexComponent[] = [];
  const actionContents = (layout.actions ?? [])
    .map(buildActionComponent)
    .filter((action): action is FlexComponent => action !== null)
    .slice(0, 3);

  if (layout.summary?.trim()) {
    bodyContents.push({
      type: 'text',
      text: layout.summary.trim(),
      wrap: true,
      size: 'sm',
      color: '#374151',
    } as FlexComponent);
  }

  const renderedSections = (layout.sections ?? [])
    .filter((section) => section.label.trim() && section.value.trim())
    .map((section) => buildSectionComponent({
      label: section.label.trim(),
      value: section.value.trim(),
      color: toneToLineColor(section.tone),
    }));

  if (renderedSections.length > 0) {
    if (bodyContents.length > 0) {
      bodyContents.push({ type: 'separator', margin: 'md', color: '#E5E7EB' } as FlexComponent);
    }

    renderedSections.forEach((section, index) => {
      bodyContents.push(section);
      if (index < renderedSections.length - 1) {
        bodyContents.push({ type: 'separator', margin: 'md', color: '#F3F4F6' } as FlexComponent);
      }
    });
  }

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: headerColor,
      contents: [
        ...(layout.eyebrow?.trim()
          ? [{
              type: 'text',
              text: layout.eyebrow.trim(),
              size: 'xs',
              color: '#FFFFFFCC',
            } satisfies FlexComponent]
          : []),
        {
          type: 'text',
          text: layout.title.trim(),
          size: 'lg',
          weight: 'bold',
          wrap: true,
          color: '#FFFFFF',
        } as FlexComponent,
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: bodyContents.length > 0
        ? bodyContents
        : [{
            type: 'text',
            text: instance.fallbackText,
            wrap: true,
            size: 'sm',
            color: '#374151',
          } as FlexComponent],
    },
    ...(actionContents.length > 0
      ? {
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            paddingAll: '16px',
            contents: actionContents,
          },
        }
      : {}),
  };

  return {
    type: 'flex',
    altText: instance.altText,
    contents: bubble,
  };
}
