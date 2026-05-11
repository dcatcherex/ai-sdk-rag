import type { RichMessageInstance } from '@/features/rich-messages/types';

export function buildRichMessageFallbackText(instance: RichMessageInstance): string {
  const { resolvedLayout } = instance;
  const parts: string[] = [];
  const normalizedTitle = resolvedLayout.title.trim();
  const normalizedSummary = resolvedLayout.summary?.trim() ?? '';

  if (resolvedLayout.eyebrow?.trim()) {
    parts.push(resolvedLayout.eyebrow.trim());
  }

  if (normalizedTitle && !normalizedTitle.includes('{{')) {
    parts.push(normalizedTitle);
  }

  if (resolvedLayout.subtitle?.trim()) {
    parts.push(resolvedLayout.subtitle.trim());
  }

  if (normalizedSummary && !normalizedSummary.includes('{{')) {
    parts.push(normalizedSummary);
  }

  for (const section of resolvedLayout.sections ?? []) {
    const label = section.label.trim();
    const value = section.value.trim();
    if (!label || !value) {
      continue;
    }
    parts.push(`${label}: ${value}`);
  }

  for (const metric of resolvedLayout.metrics ?? []) {
    const label = metric.label.trim();
    const value = [metric.value.trim(), metric.unit?.trim()].filter(Boolean).join(' ');
    if (!label || !value) {
      continue;
    }
    parts.push(`${label}: ${value}`);
  }

  if ((resolvedLayout.actions ?? []).length > 0) {
    parts.push(
      [
        'Actions:',
        ...(resolvedLayout.actions ?? []).map((action, index) => `${index + 1}. ${action.label}`),
      ].join('\n'),
    );
  }

  return parts.filter(Boolean).join('\n\n').trim();
}
