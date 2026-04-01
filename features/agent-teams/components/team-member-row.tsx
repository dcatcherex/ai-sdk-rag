'use client';

import { useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AgentTeamMemberRow } from '../types';

type TeamMemberRowProps = {
  member: AgentTeamMemberRow & {
    agentName: string;
    agentDescription: string | null;
    agentModelId: string | null;
  };
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdateDisplayRole: (displayRole: string) => void;
  isDeleting?: boolean;
  isUpdating?: boolean;
};

const ROLE_STYLES = {
  orchestrator: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  specialist: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
};

export function TeamMemberRow({
  member,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdateDisplayRole,
  isDeleting,
  isUpdating,
}: TeamMemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [displayRoleDraft, setDisplayRoleDraft] = useState(member.displayRole ?? '');

  function handleSave() {
    onUpdateDisplayRole(displayRoleDraft.trim());
    setEditing(false);
  }

  function handleCancel() {
    setDisplayRoleDraft(member.displayRole ?? '');
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
      {/* Position badge */}
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {member.position + 1}
      </span>

      {/* Agent info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{member.agentName}</span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              ROLE_STYLES[member.role as keyof typeof ROLE_STYLES] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {member.role}
          </span>
        </div>

        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              value={displayRoleDraft}
              onChange={(e) => setDisplayRoleDraft(e.target.value)}
              placeholder="Display role (e.g. Research Lead)"
              className="h-6 text-xs px-2 py-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
            />
            <Button type="button" variant="ghost" size="icon" className="size-6" onClick={handleSave}>
              <CheckIcon className="size-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-6" onClick={handleCancel}>
              <XIcon className="size-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">
              {member.displayRole || member.agentDescription || 'No description'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-4 opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0"
              onClick={() => {
                setDisplayRoleDraft(member.displayRole ?? '');
                setEditing(true);
              }}
              disabled={isUpdating}
            >
              <PencilIcon className="size-2.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMoveUp}
          disabled={isFirst || isUpdating}
          title="Move up"
        >
          <ChevronUpIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onMoveDown}
          disabled={isLast || isUpdating}
          title="Move down"
        >
          <ChevronDownIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
          title="Remove member"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
