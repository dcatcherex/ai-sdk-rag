'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, MessageCircleIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/features/agents/hooks/use-agents';
import { RichMenuPanel } from './rich-menu-panel';
import { BroadcastPanel } from './broadcast-panel';
import { AccountLinkPanel } from './account-link-panel';
import type { CreateLineOaChannelInput, LineOaChannel } from '../types';

// ── Settings form ─────────────────────────────────────────────────────────────

type SettingsFormProps = {
  channel: LineOaChannel | null;
  onBack: () => void;
  onSubmit: (data: CreateLineOaChannelInput) => void;
  isPending?: boolean;
};

const SettingsForm = ({ channel, onBack, onSubmit, isPending }: SettingsFormProps) => {
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents ?? [];
  const ownAgents = agents.filter((a) => !('ownerName' in a) || !a.ownerName);

  const isEdit = Boolean(channel);

  const [imageUrl, setImageUrl] = useState('');
  const [name, setName] = useState('');
  const [lineChannelId, setLineChannelId] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [channelAccessToken, setChannelAccessToken] = useState('');
  const [agentId, setAgentId] = useState<string>('none');
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (channel) {
      setImageUrl(channel.imageUrl ?? '');
      setName(channel.name);
      setLineChannelId(channel.lineChannelId);
      setChannelSecret('');
      setChannelAccessToken('');
      setAgentId(channel.agentId ?? 'none');
    } else {
      setImageUrl('');
      setName('');
      setLineChannelId('');
      setChannelSecret('');
      setChannelAccessToken('');
      setAgentId('none');
    }
    setShowSecret(false);
    setShowToken(false);
  }, [channel]);

  const canSubmit =
    name.trim() &&
    lineChannelId.trim() &&
    (isEdit
      ? true  // credentials optional on edit (blank = keep current)
      : channelSecret.trim() && channelAccessToken.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      lineChannelId: lineChannelId.trim(),
      channelSecret: channelSecret.trim(),
      channelAccessToken: channelAccessToken.trim(),
      agentId: agentId === 'none' ? null : agentId,
      imageUrl: imageUrl || null,
      status: channel?.status ?? 'active',
    });
  };

  const uploadChannelCover = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/line-oa/image', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json() as { url: string };
    return json.url;
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-lg">
        <ImageUploadZone
          value={imageUrl}
          onChange={setImageUrl}
          onUpload={uploadChannelCover}
          label="Cover image"
          hint="Optional. Shown on the channel card."
        />

        <div className="space-y-1.5">
          <Label htmlFor="loa-name">Display name</Label>
          <Input
            id="loa-name"
            placeholder="e.g. Customer Support Bot"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loa-channel-id">Channel ID</Label>
          <Input
            id="loa-channel-id"
            placeholder="From LINE Developers Console → Basic Settings"
            value={lineChannelId}
            onChange={(e) => setLineChannelId(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loa-secret">
            Channel Secret{' '}
            {isEdit && (
              <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="loa-secret"
              type={showSecret ? 'text' : 'password'}
              placeholder="From Basic Settings tab"
              value={channelSecret}
              onChange={(e) => setChannelSecret(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loa-token">
            Channel Access Token{' '}
            {isEdit && (
              <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="loa-token"
              type={showToken ? 'text' : 'password'}
              placeholder="From Messaging API tab → Issue"
              value={channelAccessToken}
              onChange={(e) => setChannelAccessToken(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Linked agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="No agent (use default assistant)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No agent</SelectItem>
              {ownAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The selected agent&apos;s system prompt and model will be used to reply to LINE users.
          </p>
        </div>

      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isPending}>
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Connect'}
        </Button>
      </div>
    </form>
  );
};

// ── LineOaEditorPanel ─────────────────────────────────────────────────────────

type LineOaEditorPanelProps = {
  channel: LineOaChannel | null;
  onBack: () => void;
  onSubmit: (data: CreateLineOaChannelInput) => void;
  isPending?: boolean;
};

export const LineOaEditorPanel = ({
  channel,
  onBack,
  onSubmit,
  isPending,
}: LineOaEditorPanelProps) => {
  const isEdit = Boolean(channel);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={isEdit ? channel!.name : 'Connect LINE OA'}
        description={
          isEdit
            ? 'Manage settings, rich menus, broadcasts, and linked accounts for this channel.'
            : 'Connect a LINE Official Account to let your agents reply to LINE users automatically.'
        }
        icon={<MessageCircleIcon className="size-4 text-[#06c755]" />}
        leading={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onBack}
            disabled={isPending}
          >
            <ArrowLeftIcon className="size-4" />
            Back to LINE OA
          </Button>
        }
      />

      {isEdit ? (
        <Tabs defaultValue="settings" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-6 pt-2">
            <TabsList className="h-9">
              <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
              <TabsTrigger value="rich-menus" className="text-xs">Rich Menus</TabsTrigger>
              <TabsTrigger value="broadcasts" className="text-xs">Broadcasts</TabsTrigger>
              <TabsTrigger value="linked-accounts" className="text-xs">Linked Accounts</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col mt-0">
            <SettingsForm
              channel={channel}
              onBack={onBack}
              onSubmit={onSubmit}
              isPending={isPending}
            />
          </TabsContent>

          <TabsContent value="rich-menus" className="flex min-h-0 flex-1 flex-col mt-0 overflow-y-auto p-6">
            <RichMenuPanel
              channelId={channel!.id}
              memberRichMenuLineId={channel!.memberRichMenuLineId ?? null}
            />
          </TabsContent>

          <TabsContent value="broadcasts" className="flex min-h-0 flex-1 flex-col mt-0 overflow-y-auto p-6">
            <BroadcastPanel channelId={channel!.id} />
          </TabsContent>

          <TabsContent value="linked-accounts" className="flex min-h-0 flex-1 flex-col mt-0 overflow-y-auto p-6">
            <AccountLinkPanel channelId={channel!.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <SettingsForm
          channel={null}
          onBack={onBack}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </div>
  );
};
