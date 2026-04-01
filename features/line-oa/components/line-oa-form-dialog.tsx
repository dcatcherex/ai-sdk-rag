'use client';

import { useEffect, useState } from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/features/agents/hooks/use-agents';
import type { CreateLineOaChannelInput, LineOaChannel } from '../types';

type Props = {
  open: boolean;
  channel?: LineOaChannel | null;
  onClose: () => void;
  onSubmit: (data: CreateLineOaChannelInput) => void;
  isPending?: boolean;
};

export const LineOaFormDialog = ({ open, channel, onClose, onSubmit, isPending }: Props) => {
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents ?? [];

  const [name, setName] = useState('');
  const [lineChannelId, setLineChannelId] = useState('');
  const [channelSecret, setChannelSecret] = useState('');
  const [channelAccessToken, setChannelAccessToken] = useState('');
  const [agentId, setAgentId] = useState<string>('none');
  const [isActive, setIsActive] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setLineChannelId(channel.lineChannelId);
      setChannelSecret('');
      setChannelAccessToken('');
      setAgentId(channel.agentId ?? 'none');
      setIsActive(channel.status === 'active');
    } else {
      setName('');
      setLineChannelId('');
      setChannelSecret('');
      setChannelAccessToken('');
      setAgentId('none');
      setIsActive(true);
    }
    setShowSecret(false);
    setShowToken(false);
  }, [channel, open]);

  const isEditing = !!channel;
  const canSubmit =
    name.trim() &&
    lineChannelId.trim() &&
    (!isEditing || channelSecret || channelAccessToken
      ? channelSecret.trim() && channelAccessToken.trim()
      : true) &&
    (!isEditing ? channelSecret.trim() && channelAccessToken.trim() : true);

  const handleSubmit = () => {
    const data: CreateLineOaChannelInput = {
      name: name.trim(),
      lineChannelId: lineChannelId.trim(),
      channelSecret: channelSecret.trim(),
      channelAccessToken: channelAccessToken.trim(),
      agentId: agentId === 'none' ? null : agentId,
      status: isActive ? 'active' : 'inactive',
    };
    onSubmit(data);
  };

  // Only own agents can be used
  const ownAgents = agents.filter((a) => !('ownerName' in a) || !a.ownerName);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit LINE OA' : 'Connect LINE OA'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="loa-name">Display name</Label>
            <Input
              id="loa-name"
              placeholder="e.g. Customer Support Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* LINE Channel ID */}
          <div className="space-y-1.5">
            <Label htmlFor="loa-channel-id">Channel ID</Label>
            <Input
              id="loa-channel-id"
              placeholder="From LINE Developers Console → Basic Settings"
              value={lineChannelId}
              onChange={(e) => setLineChannelId(e.target.value)}
            />
          </div>

          {/* Channel Secret */}
          <div className="space-y-1.5">
            <Label htmlFor="loa-secret">
              Channel Secret {isEditing && <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>}
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

          {/* Channel Access Token */}
          <div className="space-y-1.5">
            <Label htmlFor="loa-token">
              Channel Access Token {isEditing && <span className="text-muted-foreground text-xs">(leave blank to keep current)</span>}
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

          {/* Linked Agent */}
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

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="loa-active">Active</Label>
            <Switch id="loa-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
