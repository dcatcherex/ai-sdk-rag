'use client';

import { Badge } from '@/components/ui/badge';
import type { UserToolRun } from '../hooks/use-user-tools';

export function ToolRunHistory({ runs }: { runs: UserToolRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        No runs yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div key={run.id} className="rounded-lg border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{run.source}</p>
              <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p>
            </div>
            <Badge variant={run.status === 'success' ? 'default' : run.status === 'error' ? 'destructive' : 'secondary'}>
              {run.status}
            </Badge>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted/30 p-3 text-xs">
            {JSON.stringify({
              input: run.inputJson,
              output: run.outputJson,
              error: run.errorMessage,
            }, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
