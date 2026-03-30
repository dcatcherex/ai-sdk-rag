'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart2Icon, CalendarIcon, CheckIcon, CopyIcon, CoinsIcon, EyeIcon, EyeOffIcon,
  GlobeIcon, HashIcon, LinkIcon, LockIcon, MessageCircleIcon, MonitorIcon, UsersIcon, XIcon,
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
  useShareAnalytics,
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

/** Return ISO date string for today + N days */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
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
  const [maxUses, setMaxUses] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [savingProtection, setSavingProtection] = useState(false);

  const shareUrl = share
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/agent/${share.shareToken}`
    : '';
  const embedCode = shareUrl
    ? `<iframe src="${shareUrl}/chat" width="400" height="600" frameborder="0" allow="clipboard-write" style="border-radius:16px"></iframe>`
    : '';

  const today = new Date().toISOString().split('T')[0]!;

  const handleSaveProtection = async () => {
    setSavingProtection(true);
    try {
      await updateShare.mutateAsync({
        ...(newPassword !== '' ? { password: newPassword || null } : {}),
        ...(expiryDate !== '' ? { expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null } : {}),
        ...(maxUses !== '' ? { maxUses: maxUses ? parseInt(maxUses, 10) : null } : {}),
        ...(creditLimit !== '' ? { creditLimit: creditLimit ? parseInt(creditLimit, 10) : null } : {}),
        ...(welcomeMessage !== '' ? { welcomeMessage: welcomeMessage || null } : {}),
      });
      setNewPassword('');
      setExpiryDate('');
      setMaxUses('');
      setCreditLimit('');
      setWelcomeMessage('');
    } finally {
      setSavingProtection(false);
    }
  };

  const protectionDirty = newPassword !== '' || expiryDate !== '' || maxUses !== '' || creditLimit !== '' || welcomeMessage !== '';

  const expiresDisplay = share?.expiresAt
    ? new Date(share.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  const hasLimits = share && (share.hasPassword || share.expiresAt || share.maxUses !== null || share.creditLimit !== null);

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
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                <p className="text-base font-semibold">{share.shareCount}</p>
                <p className="text-[11px] text-muted-foreground">Views</p>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                <p className="text-base font-semibold">{share.conversationCount}</p>
                <p className="text-[11px] text-muted-foreground">
                  {share.maxUses !== null ? `/ ${share.maxUses}` : 'Uses'}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                <p className="text-base font-semibold">{share.creditsUsed}</p>
                <p className="text-[11px] text-muted-foreground">
                  {share.creditLimit !== null ? `/ ${share.creditLimit} cr` : 'Credits'}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                  {share.isActive ? 'Open' : 'Paused'}
                </p>
                <p className="text-[11px] text-muted-foreground">Status</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="link">
              <TabsList className="w-full">
                <TabsTrigger value="link" className="flex-1 gap-1">
                  <LinkIcon className="size-3.5" /> Link
                </TabsTrigger>
                <TabsTrigger value="embed" className="flex-1 gap-1">
                  <MonitorIcon className="size-3.5" /> Embed
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex-1">QR</TabsTrigger>
                <TabsTrigger value="protect" className="flex-1 gap-1">
                  <LockIcon className="size-3" />
                  Limits
                  {hasLimits && (
                    <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 gap-1">
                  <BarChart2Icon className="size-3" />
                  Stats
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
                  Share via LINE, Facebook, Email, or any messaging app. Recipients can chat without signing up.
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

              {/* Limits / Protection tab */}
              <TabsContent value="protect" className="mt-3 space-y-5">

                {/* Active limit badges */}
                {hasLimits && (
                  <div className="flex flex-wrap gap-1.5">
                    {share.hasPassword && (
                      <Badge icon={<LockIcon className="size-2.5" />} label="Password set" color="amber"
                        onRemove={() => updateShare.mutate({ password: null })} />
                    )}
                    {expiresDisplay && (
                      <Badge icon={<CalendarIcon className="size-2.5" />} label={`Expires ${expiresDisplay}`} color="blue"
                        onRemove={() => updateShare.mutate({ expiresAt: null })} />
                    )}
                    {share.maxUses !== null && (
                      <Badge icon={<HashIcon className="size-2.5" />} label={`Max ${share.maxUses} uses`} color="violet"
                        onRemove={() => updateShare.mutate({ maxUses: null })} />
                    )}
                    {share.creditLimit !== null && (
                      <Badge icon={<CoinsIcon className="size-2.5" />} label={`${share.creditLimit} cr budget`} color="green"
                        onRemove={() => updateShare.mutate({ creditLimit: null })} />
                    )}
                  </div>
                )}

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <LockIcon className="size-3" />
                    {share.hasPassword ? 'Change password' : 'Set password'}
                    <span className="text-muted-foreground font-normal">(optional)</span>
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
                </div>

                {/* Expiry */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <CalendarIcon className="size-3" />
                    Expiry date
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  {/* Presets */}
                  <div className="flex gap-1.5 flex-wrap">
                    {([['1 day', 1], ['1 week', 7], ['1 month', 30]] as const).map(([label, days]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setExpiryDate(daysFromNow(days))}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition
                          ${expiryDate === daysFromNow(days)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                    {expiryDate && (
                      <button
                        type="button"
                        onClick={() => setExpiryDate('')}
                        className="rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Input
                    type="date"
                    min={today}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Max uses */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <HashIcon className="size-3" />
                    Max conversations
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={share.maxUses !== null ? String(share.maxUses) : 'e.g. 10'}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Link stops working after this many AI replies across all guests.
                  </p>
                </div>

                {/* Credit limit */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <CoinsIcon className="size-3" />
                    Credit budget
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={share.creditLimit !== null ? String(share.creditLimit) : 'e.g. 50'}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Link pauses when this many credits have been spent ({share.creditsUsed} used so far).
                  </p>
                </div>

                {/* Welcome message */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <MessageCircleIcon className="size-3" />
                    Welcome message
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <textarea
                    rows={3}
                    placeholder={share.welcomeMessage ?? 'e.g. Hi! I\'m your math tutor. Ask me anything 😊'}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown as the first message when guests open the chat.
                    {share.welcomeMessage && (
                      <button
                        type="button"
                        className="ml-1.5 text-destructive hover:underline"
                        onClick={() => updateShare.mutate({ welcomeMessage: null })}
                      >
                        Remove current
                      </button>
                    )}
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  disabled={!protectionDirty || savingProtection}
                  onClick={handleSaveProtection}
                >
                  {savingProtection ? 'Saving…' : 'Save settings'}
                </Button>
              </TabsContent>
              {/* Analytics tab */}
              <TabsContent value="analytics" className="mt-3">
                <AnalyticsPanel agentId={agentId} />
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

// Analytics panel
function AnalyticsPanel({ agentId }: { agentId: string }) {
  const { data, isLoading } = useShareAnalytics(agentId);

  if (isLoading) {
    return <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>;
  }
  if (!data) return null;

  const { dailyStats, topMessages, totals } = data;

  const maxChats = Math.max(...dailyStats.map((d) => d.chats), 1);
  const maxViews = Math.max(...dailyStats.map((d) => d.views), 1);
  const maxBar = Math.max(maxChats, maxViews);

  // Format day label: show month/day for the first of month and every 7th, else day only
  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    if (d.getDate() === 1 || dailyStats.findIndex((s) => s.day === iso) % 7 === 0) {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    return String(d.getDate());
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <EyeIcon className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Views</span>
          </div>
          <p className="text-lg font-semibold">{totals.views}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <MessageCircleIcon className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Chats</span>
          </div>
          <p className="text-lg font-semibold">{totals.chats}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <UsersIcon className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Sessions</span>
          </div>
          <p className="text-lg font-semibold">{totals.uniqueSessions}</p>
        </div>
      </div>

      {/* Bar chart — last 14 days */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-2">Last 14 days</p>
        <div className="flex items-end gap-px h-20">
          {dailyStats.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-px group relative">
              {/* Chats bar */}
              <div
                className="w-full rounded-sm bg-primary/70 transition-all"
                style={{ height: `${maxBar > 0 ? Math.max((d.chats / maxBar) * 68, d.chats > 0 ? 3 : 0) : 0}px` }}
              />
              {/* Views bar (behind/under) */}
              <div
                className="w-full rounded-sm bg-muted-foreground/20 transition-all"
                style={{ height: `${maxBar > 0 ? Math.max((d.views / maxBar) * 68, d.views > 0 ? 3 : 0) : 0}px` }}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition z-10 whitespace-nowrap">
                <div className="rounded-md bg-popover border border-border shadow-sm px-2 py-1 text-[10px] text-foreground">
                  <span className="text-muted-foreground">{d.day.slice(5)}</span>
                  {d.views > 0 && <span className="ml-1 text-muted-foreground">{d.views}v</span>}
                  {d.chats > 0 && <span className="ml-1 text-primary">{d.chats}c</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* X-axis labels */}
        <div className="flex gap-px mt-1">
          {dailyStats.map((d) => (
            <div key={d.day} className="flex-1 text-center text-[8px] text-muted-foreground overflow-hidden">
              {dayLabel(d.day)}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block size-2 rounded-sm bg-primary/70" /> Chats
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block size-2 rounded-sm bg-muted-foreground/30" /> Views
          </span>
        </div>
      </div>

      {/* Top first messages */}
      {topMessages.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">Top opening messages</p>
          <ol className="space-y-1.5">
            {topMessages.map((m, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground w-4 text-right mt-px">
                  {i + 1}.
                </span>
                <span className="text-xs text-foreground flex-1 line-clamp-2">{m.message}</span>
                <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">×{m.count}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {totals.chats === 0 && totals.views === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No activity yet — share the link to get started.
        </p>
      )}
    </div>
  );
}

// Small status badge with remove button
function Badge({
  icon, label, color, onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'amber' | 'blue' | 'violet' | 'green';
  onRemove: () => void;
}) {
  const colors = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    green: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${colors[color]} text-[11px] px-2 py-0.5 font-medium`}>
      {icon} {label}
      <button type="button" className="ml-0.5 opacity-70 hover:opacity-100 transition" onClick={onRemove}>
        <XIcon className="size-2.5" />
      </button>
    </span>
  );
}
