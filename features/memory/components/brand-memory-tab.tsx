'use client';

import { useMemo, useState } from 'react';
import { ArchiveIcon, CheckIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveBrandMemory,
  useArchiveBrandMemory,
  useBrandMemory,
  useCreateBrandMemory,
  useDeleteBrandMemory,
  useRejectBrandMemory,
  useUpdateBrandMemory,
} from '@/features/memory/hooks/use-memory';
import type { BrandMemoryRecord, MemoryStatus } from '@/features/memory/types';

type Props = {
  brandId: string;
};

type DraftState = {
  title: string;
  category: string;
  content: string;
};

const emptyDraft: DraftState = {
  title: '',
  category: '',
  content: '',
};

const statusLabels: Record<MemoryStatus, string> = {
  approved: 'Approved',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  archived: 'Archived',
};

const formatTimestamp = (value: Date | string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const toDraft = (record: BrandMemoryRecord): DraftState => ({
  title: record.title,
  category: record.category ?? '',
  content: record.content,
});

export function BrandMemoryTab({ brandId }: Props) {
  const { data, isLoading } = useBrandMemory(brandId);
  const createMutation = useCreateBrandMemory(brandId);
  const updateMutation = useUpdateBrandMemory(brandId);
  const approveMutation = useApproveBrandMemory(brandId);
  const rejectMutation = useRejectBrandMemory(brandId);
  const archiveMutation = useArchiveBrandMemory(brandId);
  const deleteMutation = useDeleteBrandMemory(brandId);

  const [activeStatus, setActiveStatus] = useState<MemoryStatus>('approved');
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState('');

  const records = data?.records ?? [];
  const permissions = data?.permissions ?? {
    canRead: false,
    canWrite: false,
    isOwner: false,
    workspaceRole: null,
  };

  const grouped = useMemo(() => ({
    approved: records.filter((record) => record.status === 'approved'),
    pending_review: records.filter((record) => record.status === 'pending_review'),
    rejected: records.filter((record) => record.status === 'rejected'),
    archived: records.filter((record) => record.status === 'archived'),
  }), [records]);

  const resetComposer = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowComposer(false);
    setError('');
  };

  const openNewComposer = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setShowComposer(true);
    setError('');
  };

  const openEditComposer = (record: BrandMemoryRecord) => {
    setDraft(toDraft(record));
    setEditingId(record.id);
    setShowComposer(true);
    setError('');
  };

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.content.trim()) {
      setError('Title and content are required.');
      return;
    }

    setError('');

    const payload = {
      title: draft.title.trim(),
      category: draft.category.trim() || null,
      content: draft.content.trim(),
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ memoryId: editingId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetComposer();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to save memory');
    }
  };

  const renderActions = (record: BrandMemoryRecord) => {
    if (!permissions.canWrite) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {record.status !== 'approved' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => approveMutation.mutate(record.id)}
          >
            <CheckIcon className="mr-1.5 size-3.5" />
            Approve
          </Button>
        )}

        {record.status === 'pending_review' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => rejectMutation.mutate(record.id)}
          >
            <XIcon className="mr-1.5 size-3.5" />
            Reject
          </Button>
        )}

        {record.status !== 'archived' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => archiveMutation.mutate(record.id)}
          >
            <ArchiveIcon className="mr-1.5 size-3.5" />
            Archive
          </Button>
        )}

        {record.status === 'archived' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => approveMutation.mutate(record.id)}
          >
            <RotateCcwIcon className="mr-1.5 size-3.5" />
            Restore
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => openEditComposer(record)}
        >
          <PencilIcon className="mr-1.5 size-3.5" />
          Edit
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate(record.id)}
        >
          <Trash2Icon className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Shared memory</p>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Approved memory is injected into chat as shared business context for this brand.
            Pending or rejected items stay out of the prompt until approved.
          </p>
        </div>

        {permissions.canWrite && (
          <Button type="button" size="sm" onClick={openNewComposer}>
            <PlusIcon className="mr-1.5 size-3.5" />
            Add memory
          </Button>
        )}
      </div>

      {!permissions.canWrite && (
        <div className="rounded-lg border border-dashed border-black/10 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-border">
          This workspace is read-only for you. Brand owners and workspace admins can create or approve shared memory.
        </div>
      )}

      {showComposer && permissions.canWrite && (
        <div className="space-y-3 rounded-xl border border-black/5 bg-muted/20 p-4 dark:border-border">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {editingId ? 'Edit memory' : 'New shared memory'}
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={resetComposer}>
              Cancel
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-memory-title">Title</Label>
            <Input
              id="brand-memory-title"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g. Brand voice must stay practical and warm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-memory-category">Category</Label>
            <Input
              id="brand-memory-category"
              value={draft.category}
              onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="voice, process, audience, terminology..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-memory-content">Content</Label>
            <Textarea
              id="brand-memory-content"
              value={draft.content}
              onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
              rows={5}
              placeholder="Write the durable fact, rule, or constraint that other chats should remember."
              className="resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Save changes' : 'Create memory'}
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as MemoryStatus)}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {(['approved', 'pending_review', 'rejected', 'archived'] as MemoryStatus[]).map((status) => (
            <TabsTrigger
              key={status}
              value={status}
              className="rounded-full border border-black/5 bg-background px-3 py-1.5 text-xs data-[state=active]:border-primary dark:border-border"
            >
              {statusLabels[status]}
              <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                {grouped[status].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {(['approved', 'pending_review', 'rejected', 'archived'] as MemoryStatus[]).map((status) => (
          <TabsContent key={status} value={status} className="mt-4 space-y-3">
            {grouped[status].map((record) => (
              <div
                key={record.id}
                className="space-y-3 rounded-xl border border-black/5 bg-muted/15 p-4 dark:border-border"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{record.title}</p>
                      <Badge variant={record.status === 'approved' ? 'default' : 'secondary'}>
                        {statusLabels[record.status]}
                      </Badge>
                      {record.category && (
                        <Badge variant="outline">{record.category}</Badge>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">
                      {record.content}
                    </p>
                  </div>

                  <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <p>Updated {formatTimestamp(record.updatedAt)}</p>
                    {record.approvedAt && <p>Approved {formatTimestamp(record.approvedAt)}</p>}
                  </div>
                </div>

                {renderActions(record)}
              </div>
            ))}

            {!isLoading && grouped[status].length === 0 && (
              <p className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-xs text-muted-foreground dark:border-border">
                No {statusLabels[status].toLowerCase()} memory yet.
              </p>
            )}

            {isLoading && (
              <p className="text-xs text-muted-foreground">Loading shared memory…</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
