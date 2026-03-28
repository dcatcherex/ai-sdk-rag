'use client';

import { useState } from 'react';
import {
  LinkIcon,
  PlusIcon,
  Trash2Icon,
  SendIcon,
  CopyIcon,
  CheckIcon,
  UserCircle2Icon,
  TimerIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAccountLinks,
  useGenerateLinkToken,
  useDeleteLink,
  usePushToLink,
} from '../hooks/use-links';
import type { AccountLink, GeneratedToken } from '../hooks/use-links';

function TokenDialog({
  channelId,
  token,
  onClose,
}: {
  channelId: string;
  token: GeneratedToken;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiresAt = new Date(token.expiresAt);
  const minutesLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Link your LINE account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Send the following command in your LINE chat with this bot:
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-3">
            <code className="flex-1 text-base font-mono font-semibold tracking-widest text-foreground">
              /link {token.token}
            </code>
            <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={copy}>
              {copied ? <CheckIcon className="size-3.5 text-green-500" /> : <CopyIcon className="size-3.5" />}
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TimerIcon className="size-3.5" />
            Expires in {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}
          </div>
          <p className="text-xs text-muted-foreground">
            Once you send the command, your LINE user ID will be permanently linked to your account
            on this channel.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PushDialog({
  link,
  channelId,
  onClose,
}: {
  link: AccountLink;
  channelId: string;
  onClose: () => void;
}) {
  const [messageText, setMessageText] = useState('');
  const push = usePushToLink(channelId);

  const handleSend = () => {
    if (!messageText.trim()) return;
    push.mutate(
      { linkId: link.id, messageText: messageText.trim() },
      { onSuccess: () => { onClose(); setMessageText(''); } },
    );
  };

  const displayLabel = link.displayName ?? link.lineUserId;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Push message to {displayLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message…"
              rows={4}
              maxLength={5000}
              className="resize-none"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {messageText.length} / 5000
            </p>
          </div>
          {push.isError && (
            <p className="text-xs text-destructive">{String(push.error)}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || push.isPending}
          >
            <SendIcon className="size-3.5 mr-1.5" />
            {push.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AccountLinkPanel({ channelId }: { channelId: string }) {
  const { data: links = [], isLoading } = useAccountLinks(channelId);
  const generateToken = useGenerateLinkToken(channelId);
  const deleteLink = useDeleteLink(channelId);

  const [tokenDialog, setTokenDialog] = useState<GeneratedToken | null>(null);
  const [pushTarget, setPushTarget] = useState<AccountLink | null>(null);

  const handleGenerateToken = () => {
    generateToken.mutate(undefined, {
      onSuccess: (data) => setTokenDialog(data),
    });
  };

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LinkIcon className="size-3.5" />
          Linked Accounts ({links.length})
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 px-2"
          onClick={handleGenerateToken}
          disabled={generateToken.isPending}
        >
          <PlusIcon className="size-3" />
          Link
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && links.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No linked accounts — click Link to generate a code and connect your LINE account.
        </p>
      )}

      {links.map((link) => (
        <div key={link.id} className="rounded-lg border bg-background/60 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {link.pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.pictureUrl}
                  alt={link.displayName ?? link.lineUserId}
                  className="size-6 rounded-full shrink-0 object-cover"
                />
              ) : (
                <UserCircle2Icon className="size-6 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                {link.displayName && (
                  <p className="text-xs font-medium truncate">{link.displayName}</p>
                )}
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {link.lineUserId}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Badge variant="outline" className="text-[10px] h-4 px-1 hidden sm:flex">
                {new Date(link.linkedAt).toLocaleDateString()}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Push message"
                onClick={() => setPushTarget(link)}
              >
                <SendIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                onClick={() => deleteLink.mutate(link.id)}
                disabled={deleteLink.isPending}
              >
                <Trash2Icon className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Token dialog */}
      {tokenDialog && (
        <TokenDialog
          channelId={channelId}
          token={tokenDialog}
          onClose={() => setTokenDialog(null)}
        />
      )}

      {/* Push dialog */}
      {pushTarget && (
        <PushDialog
          link={pushTarget}
          channelId={channelId}
          onClose={() => setPushTarget(null)}
        />
      )}
    </div>
  );
}
