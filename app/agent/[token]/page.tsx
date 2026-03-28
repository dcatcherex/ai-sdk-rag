'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BotIcon, BookOpenIcon, CalendarXIcon, EyeIcon, EyeOffIcon, LockIcon, MessageSquareIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TOOL_REGISTRY } from '@/lib/tool-registry';

type AgentInfo = {
  id: string;
  name: string;
  description: string | null;
  enabledTools: string[];
  documentIds: string[];
};

type ShareInfo = {
  shareToken: string;
  conversationCount: number;
  guestMessageLimit: number | null;
  requiresPassword: boolean;
  expiresAt: string | null;
};

const SESSION_KEY = (token: string) => `guest-session-${token}`;

export default function PublicAgentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ok' | 'not-found' | 'expired'>('ok');

  // Password gate state
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetch(`/api/agent/${token}`)
      .then(async (r) => {
        if (r.status === 410) { setStatus('expired'); return null; }
        if (!r.ok) { setStatus('not-found'); return null; }
        return r.json() as Promise<{ agent: AgentInfo; share: ShareInfo }>;
      })
      .then((data) => {
        if (!data) return;
        setAgentInfo(data.agent);
        setShareInfo(data.share);
        // Check if already verified in this session
        if (!data.share.requiresPassword || sessionStorage.getItem(SESSION_KEY(token))) {
          setUnlocked(true);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleVerify = async () => {
    if (!password.trim()) return;
    setVerifying(true);
    setPasswordError('');
    try {
      const res = await fetch(`/api/agent/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setPasswordError(d.error ?? 'Incorrect password.');
        return;
      }
      const { sessionToken } = await res.json() as { sessionToken: string };
      sessionStorage.setItem(SESSION_KEY(token), sessionToken);
      setUnlocked(true);
    } finally {
      setVerifying(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse text-muted-foreground text-sm py-16 text-center">Loading…</div>
      </Shell>
    );
  }

  // ── Error states ──────────────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="size-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <CalendarXIcon className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-medium">This link has expired</p>
          <p className="text-sm text-muted-foreground">The owner has set an expiry date on this agent link.</p>
        </div>
      </Shell>
    );
  }

  if (status === 'not-found' || !agentInfo || !shareInfo) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-medium">Agent not found</p>
          <p className="text-sm text-muted-foreground">This link may have been disabled or deleted.</p>
        </div>
      </Shell>
    );
  }

  // ── Password gate ─────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <Shell>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BotIcon className="size-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{agentInfo.name}</h1>
              {agentInfo.description && (
                <p className="text-sm text-muted-foreground mt-1">{agentInfo.description}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-black/5 dark:border-border bg-muted/30 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <LockIcon className="size-4 text-muted-foreground" />
              Password required
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className="pr-9"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
            <Button className="w-full" onClick={handleVerify} disabled={verifying || !password.trim()}>
              {verifying ? 'Verifying…' : 'Unlock'}
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">Free · No account needed</p>
        </div>
      </Shell>
    );
  }

  // ── Agent landing ─────────────────────────────────────────────────────────
  const toolNames = agentInfo.enabledTools
    .map((id) => TOOL_REGISTRY[id as keyof typeof TOOL_REGISTRY]?.label)
    .filter(Boolean) as string[];

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BotIcon className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{agentInfo.name}</h1>
            {agentInfo.description && (
              <p className="text-sm text-muted-foreground mt-1">{agentInfo.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {toolNames.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
              <WrenchIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium">Tools</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {toolNames.map((name) => (
                    <Badge key={name} variant="secondary" className="text-[11px]">{name}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {agentInfo.documentIds.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
              <BookOpenIcon className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-medium">Knowledge base</p>
                <p className="text-xs text-muted-foreground">
                  {agentInfo.documentIds.length} document{agentInfo.documentIds.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {shareInfo.conversationCount > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
              <MessageSquareIcon className="size-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{shareInfo.conversationCount.toLocaleString()}</span> conversations
              </p>
            </div>
          )}

          {shareInfo.expiresAt && (
            <div className="flex items-center gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
              <CalendarXIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Available until {new Date(shareInfo.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <Button className="w-full" onClick={() => router.push(`/agent/${token}/chat`)}>
          Start conversation
        </Button>

        <p className="text-center text-[11px] text-muted-foreground">Free · No account needed</p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-black/5 dark:border-border bg-white/80 dark:bg-card/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)] backdrop-blur px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
