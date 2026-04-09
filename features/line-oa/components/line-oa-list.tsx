'use client';

import { useState } from 'react';
import {
  BotIcon,
  CheckCircleIcon,
  ClipboardCopyIcon,
  LayoutGridIcon,
  MegaphoneIcon,
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
import { useRichMenus } from '../hooks/use-rich-menus';
import { useBroadcasts } from '../hooks/use-broadcasts';
import { LineOaEditorPanel } from './line-oa-editor-panel';
import type { CreateLineOaChannelInput, LineOaChannel, UpdateLineOaChannelInput } from '../types';

// ── Channel card ──────────────────────────────────────────────────────────────

const ChannelCard = ({
  channel,
  onEdit,
  onDelete,
}: {
  channel: LineOaChannel;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { data: menus = [] } = useRichMenus(channel.id);
  const { data: broadcasts = [] } = useBroadcasts(channel.id);
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/line/${channel.id}`
      : `/api/line/${channel.id}`;

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 transition hover:bg-muted/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircleIcon className="size-4 shrink-0 text-[#06c755]" />
          <span className="font-medium truncate">{channel.name}</span>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onDelete}
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
        <code className="text-[10px] text-muted-foreground flex-1 truncate">{webhookUrl}</code>
        <button
          type="button"
          onClick={copyWebhook}
          className="shrink-0 text-muted-foreground hover:text-foreground transition"
          title="Copy webhook URL"
        >
          {copied ? (
            <CheckCircleIcon className="size-3.5 text-green-500" />
          ) : (
            <ClipboardCopyIcon className="size-3.5" />
          )}
        </button>
      </div>

      {/* Summary counts */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <LayoutGridIcon className="size-3" />
          {menus.length} rich menu{menus.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <MegaphoneIcon className="size-3" />
          {broadcasts.length} broadcast{broadcasts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Edit button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 w-full mt-1"
        onClick={onEdit}
      >
        <PencilIcon className="size-3" />
        Edit channel
      </Button>
    </div>
  );
};

// ── LineOaList ────────────────────────────────────────────────────────────────

export const LineOaList = () => {
  const { data: channels = [], isLoading } = useLineOaChannels();
  const createChannel = useCreateLineOaChannel();
  const updateChannel = useUpdateLineOaChannel();
  const deleteChannel = useDeleteLineOaChannel();

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<LineOaChannel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LineOaChannel | null>(null);

  const openCreate = () => { setEditTarget(null); setMode('create'); };
  const openEdit = (channel: LineOaChannel) => { setEditTarget(channel); setMode('edit'); };
  const closeEditor = () => { setMode('list'); setEditTarget(null); };

  const handleFormSubmit = (data: CreateLineOaChannelInput) => {
    if (editTarget) {
      const updateData: UpdateLineOaChannelInput & { id: string } = {
        id: editTarget.id,
        name: data.name,
        lineChannelId: data.lineChannelId,
        agentId: data.agentId,
        status: data.status,
      };
      if (data.channelSecret) updateData.channelSecret = data.channelSecret;
      if (data.channelAccessToken) updateData.channelAccessToken = data.channelAccessToken;

      updateChannel.mutate(updateData, {
        onSuccess: () => { setMode('list'); setEditTarget(null); },
      });
    } else {
      createChannel.mutate(data, {
        onSuccess: () => setMode('list'),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteChannel.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (mode !== 'list') {
    return (
      <LineOaEditorPanel
        channel={mode === 'edit' ? editTarget : null}
        onBack={closeEditor}
        onSubmit={handleFormSubmit}
        isPending={createChannel.isPending || updateChannel.isPending}
      />
    );
  }

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
          <>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onEdit={() => openEdit(channel)}
                  onDelete={() => setDeleteTarget(channel)}
                />
              ))}
            </div>

            <div className="mt-6 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Setup reminder</p>
              <p>1. Copy the webhook URL and paste it in LINE Developers Console → Messaging API → Webhook URL.</p>
              <p>2. Click <strong>Verify</strong> in the console, then enable <strong>Use webhook</strong>.</p>
              <p>3. Disable <strong>Auto-reply messages</strong> in LINE Official Account Manager to avoid duplicate replies.</p>
            </div>
          </>
        )}
      </div>

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
