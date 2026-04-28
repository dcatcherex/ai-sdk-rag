'use client';

import { PencilIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFlexDrafts, useDeleteFlexDraft } from '../hooks/use-flex-drafts';
import type { FlexDraftRecord } from '../types';

type FlexDraftListProps = {
  channelId: string;
  onEdit: (draft: FlexDraftRecord) => void;
};

export function FlexDraftList({ channelId, onEdit }: FlexDraftListProps) {
  const { data: drafts, isLoading } = useFlexDrafts(channelId);
  const deleteDraft = useDeleteFlexDraft(channelId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!drafts?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved flex messages yet. Create one above.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{draft.name}</p>
            <p className="truncate text-xs text-muted-foreground">{draft.altText}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => onEdit(draft)}>
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-destructive hover:text-destructive"
              onClick={() => deleteDraft.mutate(draft.id)}
              disabled={deleteDraft.isPending}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
