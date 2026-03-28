'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CalendarIcon, CheckIcon, CopyIcon, EyeIcon, EyeOffIcon,
  GlobeIcon, LinkIcon, LockIcon, MonitorIcon, XIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  usePublicShare,
  useCreatePublicShare,
  useUpdatePublicShare,
  useDeletePublicShare,
} from '../hooks/use-public-share';

type Props = {
  agentId: string;
  agentName: string;
  open: boolean;
  onClose: () => void;
};

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

export function PublicShareDialog({ agentId, agentName, open, onClose }: Props) {
  const { data: share, isLoading } = usePublicShare(agentId);
  const createShare = useCreatePublicShare(agentId);
  const updateShare = useUpdatePublicShare(agentId);
  const deleteShare = useDeletePublicShare(agentId);
  const { copied, copy } = useCopy();

  // Protection form state
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [savingProtection, setSavingProtection] = useState(false);

  const shareUrl = share
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/agent/${share.shareToken}`
    : '';

  const embedCode = shareUrl
    ? `<iframe src="${shareUrl}/chat" width="400" height="600" frameborder="0" allow="clipboard-write" style="border-radius:16px"></iframe>`
    : '';

  // Today's date in YYYY-MM-DD for min attribute
  const today = new Date().toISOString().split('T')[0]!;

  const handleSaveProtection = async () => {
    setSavingProtection(true);
    try {
      await updateShare.mutateAsync({
        ...(newPassword !== '' ? { password: newPassword || null } : {}),
        ...(expiryDate !== '' ? { expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null } : {}),
      });
      setNewPassword('');
      setExpiryDate('');
    } finally {
      setSavingProtection(false);
    }
  };

  const protectionDirty = newPassword !== '' || expiryDate !== '';

  const expiresDisplay = share?.expiresAt
    ? new Date(share.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-primary" />
            Share agent
          </DialogTitle>
          <DialogDescription>
            Share <span className="font-medium text-foreground">{agentName}</span> with anyone — no account needed. Credits are billed to you.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !share ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <GlobeIcon className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Create a shareable link</p>
              <p className="text-xs text-muted-foreground mt-1">
                Anyone with the link can chat with this agent for free.
              </p>
            </div>
            <Button onClick={() => createShare.mutate()} disabled={createShare.isPending}>
              {createShare.isPending ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-border px-4 py-3 bg-muted/30">
              <div>
                <Label className="text-sm font-medium">Link active</Label>
                <p className="text-xs text-muted-foreground">Disable to pause access</p>
              </div>
              <Switch
                checked={share.isActive}
                onCheckedChange={(v) => updateShare.mutate({ isActive: v })}
                disabled={updateShare.isPending}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                <p className="text-lg font-semibold">{share.conversationCount}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                  {share.isActive ? 'Open' : 'Paused'}
                </p>
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="link">
              <TabsList className="w-full">
                <TabsTrigger value="link" className="flex-1 gap-1.5">
                  <LinkIcon className="size-3.5" /> Link
                </TabsTrigger>
                <TabsTrigger value="embed" className="flex-1 gap-1.5">
                  <MonitorIcon className="size-3.5" /> Embed
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex-1">QR</TabsTrigger>
                <TabsTrigger value="protect" className="flex-1 gap-1">
                  <LockIcon className="size-3" />
                  {(share.hasPassword || share.expiresAt) && (
                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Link tab */}
              <TabsContent value="link" className="space-y-3 mt-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono"
                  />
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => copy(shareUrl)}>
                    {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share via LINE, Facebook, Email or any messaging app. Recipients can chat without signing up.
                </p>
              </TabsContent>

              {/* Embed tab */}
              <TabsContent value="embed" className="space-y-3 mt-3">
                <textarea
                  readOnly
                  value={embedCode}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono resize-none"
                />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(embedCode)}>
                  {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy embed code'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Paste into any website to embed the chat widget.
                </p>
              </TabsContent>

              {/* QR tab */}
              <TabsContent value="qr" className="mt-3 flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-4 border border-black/5">
                  <QRCodeSVG value={shareUrl} size={160} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Print or display this QR code. Scanning opens the agent chat directly.
                </p>
              </TabsContent>

              {/* Protection tab */}
              <TabsContent value="protect" className="mt-3 space-y-4">
                {/* Current status badges */}
                {(share.hasPassword || expiresDisplay) && (
                  <div className="flex flex-wrap gap-1.5">
                    {share.hasPassword && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] px-2 py-0.5 font-medium">
                        <LockIcon className="size-2.5" /> Password set
                        <button
                          className="ml-0.5 hover:text-amber-900 dark:hover:text-amber-200"
                          onClick={() => updateShare.mutate({ password: null })}
                          title="Remove password"
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </span>
                    )}
                    {expiresDisplay && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] px-2 py-0.5 font-medium">
                        <CalendarIcon className="size-2.5" /> Expires {expiresDisplay}
                        <button
                          className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-200"
                          onClick={() => updateShare.mutate({ expiresAt: null })}
                          title="Remove expiry"
                        >
                          <XIcon className="size-2.5" />
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <LockIcon className="size-3" />
                    {share.hasPassword ? 'Change password' : 'Set password'} <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder={share.hasPassword ? 'Enter new password to replace' : 'e.g. math2024'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-9 text-sm"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                      onClick={() => setShowNewPassword((v) => !v)}
                    >
                      {showNewPassword ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Guests must enter this to access the agent.</p>
                </div>

                {/* Expiry */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <CalendarIcon className="size-3" />
                    Expiry date <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    type="date"
                    min={today}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">After this date the link shows "expired".</p>
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  disabled={!protectionDirty || savingProtection}
                  onClick={handleSaveProtection}
                >
                  {savingProtection ? 'Saving…' : 'Save protection settings'}
                </Button>
              </TabsContent>
            </Tabs>

            {/* Revoke */}
            <div className="pt-2 border-t border-black/5 dark:border-border">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs w-full"
                onClick={() => deleteShare.mutate()}
                disabled={deleteShare.isPending}
              >
                {deleteShare.isPending ? 'Revoking…' : 'Revoke link'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
