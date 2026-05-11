import type {
  RichMessageInstance,
  RichMessageTone,
  WebRichMessageViewModel,
} from '@/features/rich-messages/types';
import type { WebResponseCard } from '@/features/response-format/types';

export function renderRichMessageForWeb(instance: RichMessageInstance): WebRichMessageViewModel {
  const layout = instance.resolvedLayout;

  return {
    tone: layout.tone ?? 'neutral',
    eyebrow: layout.eyebrow,
    title: layout.title,
    subtitle: layout.subtitle,
    summary: layout.summary,
    sections: (layout.sections ?? []).map((section) => ({
      label: section.label,
      value: section.value,
      tone: section.tone,
    })),
    metrics: (layout.metrics ?? []).map((metric) => ({
      label: metric.label,
      value: metric.value,
      unit: metric.unit,
      tone: metric.tone,
    })),
    actions: layout.actions ?? [],
    media: layout.media,
  };
}

export function renderRichMessageAsWebResponseCard(instance: RichMessageInstance): WebResponseCard {
  const viewModel = renderRichMessageForWeb(instance);
  const fields = [
    ...viewModel.sections.map((section) => ({
      label: section.label,
      value: section.value,
    })),
    ...viewModel.metrics.map((metric) => ({
      label: metric.label,
      value: [metric.value, metric.unit].filter(Boolean).join(' '),
    })),
  ].filter((entry) => entry.label.trim() && entry.value.trim());

  return {
    kind: 'card',
    tone: viewModel.tone === 'info' ? 'neutral' : viewModel.tone,
    eyebrow: viewModel.eyebrow,
    title: viewModel.title,
    summary: viewModel.summary,
    ...(fields.length > 0 ? { fields } : {}),
  };
}

export function getRichMessageToneClasses(tone: RichMessageTone): {
  border: string;
  badge: string;
  accent: string;
} {
  switch (tone) {
    case 'success':
      return {
        border: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100',
        accent: 'bg-emerald-600',
      };
    case 'warning':
      return {
        border: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20',
        badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
        accent: 'bg-amber-500',
      };
    case 'danger':
      return {
        border: 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20',
        badge: 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100',
        accent: 'bg-rose-600',
      };
    case 'info':
      return {
        border: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20',
        badge: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
        accent: 'bg-sky-600',
      };
    default:
      return {
        border: 'border-black/8 bg-white/90 dark:border-border dark:bg-card/80',
        badge: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100',
        accent: 'bg-zinc-500',
      };
  }
}
