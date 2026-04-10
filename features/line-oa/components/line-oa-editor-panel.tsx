'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  LayoutGridIcon,
  LinkIcon,
  MessageCircleIcon,
  RadioIcon,
  Settings2Icon,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SettingsShell, type SettingsShellItem } from '@/components/settings-shell';
import { Button } from '@/components/ui/button';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ── Section definitions ───────────────────────────────────────────────────────

type LineOaSectionId = 'settings' | 'rich-menus' | 'broadcasts' | 'linked-accounts';

const SECTIONS_CREATE: SettingsShellItem<LineOaSectionId>[] = [
  { id: 'settings', icon: Settings2Icon, label: 'Settings', description: 'Configure channel credentials and linked agent.' },
];

const SECTIONS_EDIT: SettingsShellItem<LineOaSectionId>[] = [
  { id: 'settings', icon: Settings2Icon, label: 'Settings', description: 'Configure channel credentials and linked agent.' },
  { id: 'rich-menus', icon: LayoutGridIcon, label: 'Rich Menus', description: 'Design the persistent button menu shown to LINE users.' },
  { id: 'broadcasts', icon: RadioIcon, label: 'Broadcasts', description: 'Send messages to all or filtered subscribers.' },
  { id: 'linked-accounts', icon: LinkIcon, label: 'Linked Accounts', description: 'Manage LINE user account connections.' },
];

// ── Settings fields ───────────────────────────────────────────────────────────

type SettingsFieldsProps = {
  isEdit: boolean;
  imageUrl: string;
  onImageUrlChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  lineChannelId: string;
  onLineChannelIdChange: (v: string) => void;
  channelSecret: string;
  onChannelSecretChange: (v: string) => void;
  channelAccessToken: string;
  onChannelAccessTokenChange: (v: string) => void;
  agentId: string;
  onAgentIdChange: (v: string) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
  showToken: boolean;
  onToggleToken: () => void;
};

const SettingsFields = ({
  isEdit,
  imageUrl, onImageUrlChange,
  name, onNameChange,
  lineChannelId, onLineChannelIdChange,
  channelSecret, onChannelSecretChange,
  channelAccessToken, onChannelAccessTokenChange,
  agentId, onAgentIdChange,
  showSecret, onToggleSecret,
  showToken, onToggleToken,
}: SettingsFieldsProps) => {
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents ?? [];
  const ownAgents = agents.filter((a) => !('ownerName' in a) || !a.ownerName);

  const uploadChannelCover = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/line-oa/image', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json() as { url: string };
    return json.url;
  };

  return (
    <div className="space-y-5 max-w-lg">
      <ImageUploadZone
        value={imageUrl}
        onChange={onImageUrlChange}
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
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="loa-channel-id">Channel ID</Label>
        <Input
          id="loa-channel-id"
          placeholder="From LINE Developers Console → Basic Settings"
          value={lineChannelId}
          onChange={(e) => onLineChannelIdChange(e.target.value)}
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
            onChange={(e) => onChannelSecretChange(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={onToggleSecret}
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
            onChange={(e) => onChannelAccessTokenChange(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={onToggleToken}
          >
            {showToken ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Linked agent</Label>
        <Select value={agentId} onValueChange={onAgentIdChange}>
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
  const [activeSection, setActiveSection] = useState<LineOaSectionId>('settings');

  // Form state lifted here so it survives section switches
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
    setActiveSection('settings');
  }, [channel]);

  const canSubmit =
    name.trim() &&
    lineChannelId.trim() &&
    (isEdit ? true : channelSecret.trim() && channelAccessToken.trim());

  const handleSettingsSubmit = () => {
    if (!canSubmit) return;
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

  const sections = useMemo(() => isEdit ? SECTIONS_EDIT : SECTIONS_CREATE, [isEdit]);
  const activeMeta = sections.find((s) => s.id === activeSection) ?? sections[0]!;

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

      <SettingsShell
        activeItem={activeSection}
        items={sections}
        onItemChange={setActiveSection}
        sectionTitle={activeMeta.label}
        sectionDescription={activeMeta.description}
        sidebarLabel="Settings"
        footer={
          activeSection === 'settings' ? (
            <>
              <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSettingsSubmit} disabled={!canSubmit || isPending}>
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Connect'}
              </Button>
            </>
          ) : null
        }
      >
        {activeSection === 'settings' && (
          <SettingsFields
            isEdit={isEdit}
            imageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            name={name}
            onNameChange={setName}
            lineChannelId={lineChannelId}
            onLineChannelIdChange={setLineChannelId}
            channelSecret={channelSecret}
            onChannelSecretChange={setChannelSecret}
            channelAccessToken={channelAccessToken}
            onChannelAccessTokenChange={setChannelAccessToken}
            agentId={agentId}
            onAgentIdChange={setAgentId}
            showSecret={showSecret}
            onToggleSecret={() => setShowSecret((v) => !v)}
            showToken={showToken}
            onToggleToken={() => setShowToken((v) => !v)}
          />
        )}
        {activeSection === 'rich-menus' && isEdit && (
          <RichMenuPanel
            channelId={channel!.id}
            memberRichMenuLineId={channel!.memberRichMenuLineId ?? null}
          />
        )}
        {activeSection === 'broadcasts' && isEdit && (
          <BroadcastPanel channelId={channel!.id} />
        )}
        {activeSection === 'linked-accounts' && isEdit && (
          <AccountLinkPanel channelId={channel!.id} />
        )}
      </SettingsShell>
    </div>
  );
};
