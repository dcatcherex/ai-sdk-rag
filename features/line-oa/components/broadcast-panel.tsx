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
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  broadcast: BroadcastRecord | null;
  onClose: () => void;
  onSubmit: (data: CreateBroadcastInput) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(broadcast?.name ?? '');
  const [messageText, setMessageText] = useState(broadcast?.messageText ?? '');

  // Sync when broadcast changes (open/close)
  const [prevBroadcast, setPrevBroadcast] = useState(broadcast);
  if (broadcast !== prevBroadcast) {
    setPrevBroadcast(broadcast);
    setName(broadcast?.name ?? '');
    setMessageText(broadcast?.messageText ?? '');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageText.trim()) return;
    onSubmit({ name: name.trim(), messageText: messageText.trim() });
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!name.trim() || !messageText.trim() || isPending}
            >
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
