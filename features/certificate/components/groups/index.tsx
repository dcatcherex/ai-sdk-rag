'use client';

import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup } from '../../hooks/use-groups';
import { GroupEditor } from './group-editor';
import type { RecipientGroup } from '../../types';

export function GroupsSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RecipientGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: groups = [], isLoading } = useGroups();
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const deleteMutation = useDeleteGroup();

  function toggle() {
    setIsExpanded(prev => !prev);
  }

  async function handleDelete(id: string) {
    const group = groups.find(g => g.id === id);
    const confirmed = window.confirm(
      `Delete group "${group?.name ?? id}"? This cannot be undone.`
    );
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-border">
      {/* Header row */}
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <span className="font-medium text-sm">Recipient Groups</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && !isCreating && !editingGroup && (
            <Button
              size="sm"
              variant="outline"
              onClick={e => {
                e.stopPropagation();
                setIsCreating(true);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> New group
            </Button>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3 dark:border-border space-y-3">
          {isLoading && (
            <p className="text-sm text-zinc-400">Loading groups…</p>
          )}

          {!isLoading && isCreating && (
            <GroupEditor
              onSave={async data => {
                await createMutation.mutateAsync(data);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
              isSaving={createMutation.isPending}
            />
          )}

          {!isLoading && editingGroup && (
            <GroupEditor
              group={editingGroup}
              onSave={async data => {
                await updateMutation.mutateAsync({ id: editingGroup.id, ...data });
                setEditingGroup(null);
              }}
              onCancel={() => setEditingGroup(null)}
              isSaving={updateMutation.isPending}
            />
          )}

          {!isLoading && !isCreating && !editingGroup && groups.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">
              No groups yet. Create one to reuse recipients across templates.
            </p>
          )}

          {!isLoading &&
            !isCreating &&
            !editingGroup &&
            groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-border"
              >
                <div>
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {group.recipients.length} person{group.recipients.length !== 1 ? 's' : ''}
                    {group.description ? ` • ${group.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingGroup(group)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(group.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
