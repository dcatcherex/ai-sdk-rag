'use client';

import { CheckCircle2, Circle, CircleDashed, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CaseWorkspaceTask } from '@/features/case-workspace/types';

type Props = {
  tasks: CaseWorkspaceTask[];
  onMarkDone: (taskId: string) => void;
};

function TaskIcon({ status }: { status: CaseWorkspaceTask['status'] }) {
  if (status === 'done') return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === 'doing') return <CircleDashed className="size-4 text-amber-600" />;
  if (status === 'cancelled') return <XCircle className="size-4 text-rose-600" />;
  return <Circle className="size-4 text-muted-foreground" />;
}

export function TaskList({ tasks, onMarkDone }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No tasks yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-lg border px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TaskIcon status={task.status} />
                <p className="truncate text-sm font-medium">{task.title}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="capitalize">
                  {task.status}
                </Badge>
                {task.dueAt ? <span>Due {task.dueAt}</span> : null}
              </div>
            </div>
            {task.status !== 'done' ? (
              <Button size="sm" variant="outline" onClick={() => onMarkDone(task.id)}>
                Done
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
