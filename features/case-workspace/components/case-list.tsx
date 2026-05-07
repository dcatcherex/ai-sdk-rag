'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CaseWorkspaceCase } from '@/features/case-workspace/types';

type Props = {
  cases: CaseWorkspaceCase[];
  selectedCaseId?: string;
  onSelectCase: (caseId: string) => void;
};

export function CaseList({ cases, selectedCaseId, onSelectCase }: Props) {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No cases yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {cases.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={selectedCaseId === item.id ? 'secondary' : 'ghost'}
          className="h-auto w-full justify-start rounded-lg border px-3 py-3 text-left"
          onClick={() => onSelectCase(item.id)}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{item.name}</span>
              <Badge variant="outline" className="capitalize">
                {item.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">Priority {item.priority}</span>
              {item.data.source ? <span>· {item.data.source}</span> : null}
              {item.data.dueAt ? <span>· due {item.data.dueAt}</span> : null}
            </div>
            {item.data.summary ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.data.summary}</p>
            ) : null}
          </div>
        </Button>
      ))}
    </div>
  );
}
