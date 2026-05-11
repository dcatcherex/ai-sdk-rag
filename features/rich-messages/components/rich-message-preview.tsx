'use client';

import { AlertTriangleIcon } from 'lucide-react';
import { RichMessageCard } from '@/features/rich-messages/components/rich-message-card';
import type { RichMessageInstance } from '@/features/rich-messages/types';
import { FlexPreview } from '@/features/line-oa/flex/components/flex-preview';
import { renderRichMessageForLine } from '@/features/rich-messages/adapters/line';

type RichMessagePreviewProps = {
  instance: RichMessageInstance | null;
};

export function RichMessagePreview({ instance }: RichMessagePreviewProps) {
  if (!instance) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
        Select a template to preview it.
      </div>
    );
  }

  const lineMessage = renderRichMessageForLine(instance);

  return (
    <div className="grid h-full gap-4 xl:grid-cols-2">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Web preview</div>
        </div>
        <div className="flex min-h-[520px] items-start justify-center overflow-auto p-4">
          <RichMessageCard instance={instance} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
            <AlertTriangleIcon className="size-3.5" />
            LINE preview
          </div>
        </div>
        <div className="h-[520px] bg-[#EEF2F0]">
          <FlexPreview payload={lineMessage.contents as Record<string, unknown>} />
        </div>
      </div>
    </div>
  );
}
