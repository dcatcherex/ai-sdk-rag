'use client';

import { useState } from 'react';
import {
  MegaphoneIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  PencilIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderIcon,
  LayoutTemplateIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useBroadcasts,
  useCreateBroadcast,
  useUpdateBroadcast,
  useDeleteBroadcast,
  useSendBroadcast,
} from '../hooks/use-broadcasts';
import type { BroadcastRecord, CreateBroadcastInput } from '../hooks/use-broadcasts';
import { useFlexDrafts } from '@/features/line-oa/flex/hooks/use-flex-drafts';
import type { FlexDraftRecord } from '@/features/line-oa/flex/types';

const STATUS_BADGE: Record<
  BroadcastRecord['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft:   { label: 'Draft',   variant: 'secondary' },
  sending: { label: 'Sending…', variant: 'outline' },
  sent:    { label: 'Sent',    variant: 'default' },
  partial: { label: 'Partial', variant: 'outline' },
  failed:  { label: 'Failed',  variant: 'destructive' },
};

function BroadcastEditor({
  open,
  broadcast,
  channelId,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  broadcast: BroadcastRecord | null;
  channelId: string;
  onClose: () => void;
  onSubmit: (data: CreateBroadcastInput) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(broadcast?.name ?? '');
  const [messageType, setMessageType] = useState<'text' | 'flex'>(broadcast?.messageType ?? 'text');
  const [messageText, setMessageText] = useState(broadcast?.messageText ?? '');
  const [selectedDraft, setSelectedDraft] = useState<FlexDraftRecord | null>(null);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);

  const { data: flexDrafts = [] } = useFlexDrafts(channelId);

  const [prevBroadcast, setPrevBroadcast] = useState(broadcast);
  if (broadcast !== prevBroadcast) {
    setPrevBroadcast(broadcast);
    setName(broadcast?.name ?? '');
    setMessageType(broadcast?.messageType ?? 'text');
    setMessageText(broadcast?.messageText ?? '');
    setSelectedDraft(null);
  }

  const canSubmit =
    name.trim().length > 0 &&
    (messageType === 'text' ? messageText.trim().length > 0 : Boolean(selectedDraft ?? broadcast?.messagePayload));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (messageType === 'flex') {
      const draft = selectedDraft;
      onSubmit({
        name: name.trim(),
        messageText: draft?.altText ?? broadcast?.messageText ?? '',
        messageType: 'flex',
        messagePayload: draft
          ? { altText: draft.altText, contents: draft.flexPayload }
          : broadcast?.messagePayload ?? {},
      });
    } else {
      onSubmit({ name: name.trim(), messageText: messageText.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{broadcast ? 'Edit broadcast' : 'New broadcast'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly newsletter"
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Message type toggle */}
          <div className="space-y-1.5">
            <Label>Message type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={messageType === 'text' ? 'default' : 'outline'}
                onClick={() => setMessageType('text')}
                className="flex-1"
              >
                Text
              </Button>
              <Button
                type="button"
                size="sm"
                variant={messageType === 'flex' ? 'default' : 'outline'}
                onClick={() => setMessageType('flex')}
                className="flex-1 gap-1.5"
              >
                <LayoutTemplateIcon className="size-3.5" />
                Flex Message
              </Button>
            </div>
          </div>

          {messageType === 'text' ? (
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type the message to send to all followers…"
                rows={5}
                maxLength={5000}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {messageText.length} / 5000
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Flex Message</Label>
              {selectedDraft ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedDraft.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedDraft.altText}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDraft(null)}>
                    Change
                  </Button>
                </div>
              ) : broadcast?.messagePayload ? (
                <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  Using existing flex message — pick a new one to replace.
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                onClick={() => setDraftPickerOpen(true)}
                disabled={flexDrafts.length === 0}
              >
                <LayoutTemplateIcon className="size-3.5" />
                {flexDrafts.length === 0 ? 'No saved flex messages — create one in Flex Messages tab' : 'Pick from saved flex messages'}
              </Button>

              {/* Draft picker dialog */}
              <Dialog open={draftPickerOpen} onOpenChange={setDraftPickerOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Pick a flex message</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-1 max-h-60 overflow-y-auto">
                    {flexDrafts.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => { setSelectedDraft(draft); setDraftPickerOpen(false); }}
                        className={[
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50',
                          selectedDraft?.id === draft.id ? 'border-primary bg-primary/5' : '',
                        ].join(' ')}
                      >
                        <p className="text-sm font-medium">{draft.name}</p>
                        <p className="text-xs text-muted-foreground">{draft.altText}</p>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving…' : broadcast ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BroadcastPanel({ channelId }: { channelId: string }) {
  const { data: broadcasts = [], isLoading } = useBroadcasts(channelId);
  const createBroadcast = useCreateBroadcast(channelId);
  const updateBroadcast = useUpdateBroadcast(channelId);
  const deleteBroadcast = useDeleteBroadcast(channelId);
  const sendBroadcast = useSendBroadcast(channelId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BroadcastRecord | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmSendTarget, setConfirmSendTarget] = useState<BroadcastRecord | null>(null);

  const openCreate = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (b: BroadcastRecord) => { setEditTarget(b); setEditorOpen(true); };

  const handleSubmit = (data: CreateBroadcastInput) => {
    if (editTarget) {
      updateBroadcast.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setEditorOpen(false); setEditTarget(null); } },
      );
    } else {
      createBroadcast.mutate(data, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const handleSend = (b: BroadcastRecord) => {
    setConfirmSendTarget(b);
  };

  const confirmSend = () => {
    if (!confirmSendTarget) return;
    setSendingId(confirmSendTarget.id);
    setConfirmSendTarget(null);
    sendBroadcast.mutate(confirmSendTarget.id, {
      onSettled: () => setSendingId(null),
    });
  };

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <MegaphoneIcon className="size-3.5" />
          Broadcasts ({broadcasts.length})
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={openCreate}>
          <PlusIcon className="size-3" />
          New
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && broadcasts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No broadcasts yet — create one to send a message to all followers.
        </p>
      )}

      {broadcasts.map((b) => {
        const { label, variant } = STATUS_BADGE[b.status];
        const isSending = sendingId === b.id || b.status === 'sending';

        return (
          <div key={b.id} className="rounded-lg border bg-background/60 p-2.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-medium truncate">{b.name}</span>
                <Badge variant={variant} className="text-[10px] h-4 px-1 shrink-0">
                  {isSending ? (
                    <LoaderIcon className="size-2.5 animate-spin mr-0.5" />
                  ) : b.status === 'sent' ? (
                    <CheckCircle2Icon className="size-2.5 mr-0.5" />
                  ) : b.status === 'failed' ? (
                    <AlertCircleIcon className="size-2.5 mr-0.5" />
                  ) : null}
                  {isSending ? 'Sending…' : label}
                </Badge>
                {b.recipientCount !== null && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {b.recipientCount.toLocaleString()} sent
                  </span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {b.status !== 'sent' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => openEdit(b)}
                    disabled={isSending}
                  >
                    <PencilIcon className="size-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  onClick={() => deleteBroadcast.mutate(b.id)}
                  disabled={deleteBroadcast.isPending || isSending}
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            </div>

            {/* Message preview */}
            {b.messageText && (
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {b.messageText}
              </p>
            )}

            {/* Error */}
            {b.status === 'failed' && b.errorMessage && (
              <p className="text-[10px] text-destructive bg-destructive/5 rounded px-2 py-1">
                {b.errorMessage}
              </p>
            )}

            {/* Sent timestamp */}
            {b.sentAt && (
              <p className="text-[10px] text-muted-foreground">
                Sent {new Date(b.sentAt).toLocaleString()}
              </p>
            )}

            {/* Send button */}
            {b.status !== 'sent' && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 w-full"
                disabled={isSending || !b.messageText}
                onClick={() => handleSend(b)}
              >
                <SendIcon className="size-3" />
                {isSending ? 'Sending…' : 'Send to all followers'}
              </Button>
            )}
          </div>
        );
      })}

      <BroadcastEditor
        open={editorOpen}
        broadcast={editTarget}
        channelId={channelId}
        onClose={() => { setEditorOpen(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
        isPending={createBroadcast.isPending || updateBroadcast.isPending}
      />

      {/* Confirm send dialog */}
      <Dialog open={Boolean(confirmSendTarget)} onOpenChange={(o) => { if (!o) setConfirmSendTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send broadcast?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1 text-sm">
            <p>
              This will send{' '}
              <strong>&ldquo;{confirmSendTarget?.name}&rdquo;</strong>{' '}
              to <strong>all followers</strong> of this channel immediately.
            </p>
            {confirmSendTarget?.messageText && (
              <div className="rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground whitespace-pre-wrap">
                {confirmSendTarget.messageText}
              </div>
            )}
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendTarget(null)}>Cancel</Button>
            <Button onClick={confirmSend}>Send now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
