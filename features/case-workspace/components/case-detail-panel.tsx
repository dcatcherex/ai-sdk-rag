'use client';

import { Badge } from '@/components/ui/badge';
import type { CaseWorkspaceCaseContext, CaseWorkspaceSummary } from '@/features/case-workspace/types';
import { Timeline } from './timeline';

type Props = {
  context: CaseWorkspaceCaseContext | null;
  summary: CaseWorkspaceSummary | null;
};

export function CaseDetailPanel({ context, summary }: Props) {
  if (!context) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Select a case to inspect its timeline and working context.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{context.case.name}</h2>
          <Badge variant="outline" className="capitalize">
            {context.case.status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {context.case.priority}
          </Badge>
        </div>
        {context.case.data.summary ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {context.case.data.summary}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {context.contact ? <span>Contact: {context.contact.name}</span> : null}
          {typeof context.case.data.assigneeUserId === 'string' ? <span>Assigned: {context.case.data.assigneeUserId}</span> : null}
          {context.case.data.nextAction ? <span>Next: {context.case.data.nextAction}</span> : null}
          {context.case.data.dueAt ? <span>Due: {context.case.data.dueAt}</span> : null}
        </div>
      </div>

      {summary ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-4">
          <h3 className="text-sm font-medium">AI summary</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{summary.summary}</p>
          <div className="mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Draft LINE reply
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-sm">{summary.replyDraft}</p>
          </div>
        </div>
      ) : null}

      <Timeline items={context.timeline} />
    </div>
  );
}
