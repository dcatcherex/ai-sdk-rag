'use client';

import { Badge } from '@/components/ui/badge';
import type { CaseWorkspaceTimelineItem } from '@/features/case-workspace/types';

type Props = {
  items: CaseWorkspaceTimelineItem[];
};

export function Timeline({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No timeline items yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{item.title}</h3>
            <Badge variant="outline" className="capitalize">
              {item.kind.replace('_', ' ')}
            </Badge>
          </div>
          {item.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">{item.createdAt}</p>
        </div>
      ))}
    </div>
  );
}
