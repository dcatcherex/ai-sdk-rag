'use client';

import { useState } from 'react';
import {
  BotIcon,
  CheckCircleIcon,
  ClipboardCopyIcon,
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useLineOaChannels,
  useCreateLineOaChannel,
  useUpdateLineOaChannel,
  useDeleteLineOaChannel,
} from '../hooks/use-line-oa';
import { LineOaFormDialog } from './line-oa-form-dialog';
import { RichMenuPanel } from './rich-menu-panel';
import { BroadcastPanel } from './broadcast-panel';
import { AccountLinkPanel } from './account-link-panel';
import type { CreateLineOaChannelInput, LineOaChannel, UpdateLineOaChannelInput } from '../types';

export const LineOaList = () => {
  const { data: channels = [], isLoading } = useLineOaChannels();
  const createChannel = useCreateLineOaChannel();
  const updateChannel = useUpdateLineOaChannel();
  const deleteChannel = useDeleteLineOaChannel();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LineOaChannel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LineOaChannel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const webhookUrl = (channelId: string) => {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? '';
    return `${base}/api/line/${channelId}`;
  };

  const copyWebhook = async (channelId: string) => {
    await navigator.clipboard.writeText(webhookUrl(channelId));
    setCopiedId(channelId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (channel: LineOaChannel) => {
    setEditTarget(channel);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: CreateLineOaChannelInput) => {
    if (editTarget) {
      const updateData: UpdateLineOaChannelInput & { id: string } = {
        id: editTarget.id,
        name: data.name,
        lineChannelId: data.lineChannelId,
        agentId: data.agentId,
        status: data.status,
      };
      // Only include credentials if user typed them
      if (data.channelSecret) updateData.channelSecret = data.channelSecret;
      if (data.channelAccessToken) updateData.channelAccessToken = data.channelAccessToken;

      updateChannel.mutate(updateData, {
        onSuccess: () => { setFormOpen(false); setEditTarget(null); },
      });
    } else {
      createChannel.mutate(data, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteChannel.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="LINE Official Accounts"
        description="Connect LINE OA channels to your agents and reply to users automatically"
        action={
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            Connect LINE OA
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <MessageCircleIcon className="size-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No LINE OA connected</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Connect a LINE Official Account to let your agents reply to LINE users automatically.
            </p>
            <Button onClick={openCreate} size="sm" className="gap-1.5 mt-1">
              <PlusIcon className="size-4" />
              Connect your first OA
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="group relative flex flex-col gap-3 rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 transition hover:bg-muted/50"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageCircleIcon className="size-4 shrink-0 text-[#06c755]" />
                    <span className="font-medium truncate">{channel.name}</span>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(channel)}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(channel)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={channel.status === 'active' ? 'default' : 'secondary'}
                    className="text-[11px] gap-1"
                  >
                    {channel.status === 'active' ? (
                      <CheckCircleIcon className="size-2.5" />
                    ) : (
                      <XCircleIcon className="size-2.5" />
                    )}
                    {channel.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                  {channel.agentName && (
                    <Badge variant="outline" className="text-[11px] gap-1">
                      <BotIcon className="size-2.5" />
                      {channel.agentName}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    ID: {channel.lineChannelId}
                  </Badge>
                </div>

                {/* Webhook URL */}
                <div className="flex items-center gap-2 rounded-lg bg-background/60 border px-3 py-2">
                  <code className="text-[10px] text-muted-foreground flex-1 truncate">
                    {webhookUrl(channel.id)}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyWebhook(channel.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition"
                    title="Copy webhook URL"
                  >
                    {copiedId === channel.id ? (
                      <CheckCircleIcon className="size-3.5 text-green-500" />
                    ) : (
                      <ClipboardCopyIcon className="size-3.5" />
                    )}
                  </button>
                </div>

                {/* Rich menus */}
                <RichMenuPanel channelId={channel.id} />

                {/* Broadcasts */}
                <div className="border-t pt-3 mt-1">
                  <BroadcastPanel channelId={channel.id} />
                </div>

                {/* Account links */}
                <div className="border-t pt-3 mt-1">
                  <AccountLinkPanel channelId={channel.id} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Setup guide */}
        {channels.length > 0 && (
          <div className="mt-6 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Setup reminder</p>
            <p>1. Copy the webhook URL above and paste it in LINE Developers Console → Messaging API → Webhook URL.</p>
            <p>2. Click <strong>Verify</strong> in the console, then enable <strong>Use webhook</strong>.</p>
            <p>3. Disable <strong>Auto-reply messages</strong> in LINE Official Account Manager to avoid duplicate replies.</p>
          </div>
        )}
      </div>

      <LineOaFormDialog
        open={formOpen}
        channel={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSubmit={handleFormSubmit}
        isPending={createChannel.isPending || updateChannel.isPending}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect LINE OA</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{' '}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span>?
              Existing conversation history will be preserved, but new messages will no longer be handled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteChannel.isPending}
            >
              {deleteChannel.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
