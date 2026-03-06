'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrainCircuitIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

type MemoryFact = {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
};

type Preferences = {
  memoryEnabled: boolean;
  promptEnhancementEnabled: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  preference: 'Preference',
  expertise: 'Expertise',
  context: 'Context',
  goal: 'Goal',
};

const CATEGORY_COLORS: Record<string, string> = {
  preference: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  expertise: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  context: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  goal: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
};

export default function SettingsPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({ memoryEnabled: true, promptEnhancementEnabled: true });
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const {
    activeThreadId,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    createThreadMutation,
    pinThreadMutation,
    renameThreadMutation,
    deleteThreadMutation,
    handleCreateThread,
  } = useThreads();

  const { sessionData, userProfile, isSigningOut, handleSignOut } = useUserProfile();

  const loadFacts = useCallback(async () => {
    setIsLoadingFacts(true);
    try {
      const res = await fetch('/api/user/memory');
      if (res.ok) setFacts(await res.json());
    } finally {
      setIsLoadingFacts(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [factsRes, prefsRes] = await Promise.all([
        fetch('/api/user/memory'),
        fetch('/api/user/preferences'),
      ]);
      if (factsRes.ok) setFacts(await factsRes.json());
      if (prefsRes.ok) setPrefs(await prefsRes.json());
      setIsLoadingFacts(false);
    })();
  }, []);

  const updatePref = async (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  const deleteFact = async (id: string) => {
    setFacts((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/user/memory/${id}`, { method: 'DELETE' });
  };

  const clearAllFacts = async () => {
    setIsDeletingAll(true);
    try {
      await fetch('/api/user/memory', { method: 'DELETE' });
      setFacts([]);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f7f9,#eef0f7_55%,#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6">
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          onSelectThread={(threadId) => { setActiveThreadId(threadId); router.push('/'); }}
          onCreateThread={() => { handleCreateThread(); router.push('/'); }}
          onTogglePin={(threadId, pinned) => pinThreadMutation.mutate({ threadId, pinned })}
          onRenameThread={(threadId, title) => renameThreadMutation.mutate({ threadId, title })}
          onDeleteThread={(threadId) => deleteThreadMutation.mutate(threadId)}
          sessionData={sessionData}
          userProfile={userProfile}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />

        <main className="flex h-[calc(100dvh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur md:h-[calc(100vh-3rem)] md:rounded-3xl">
          <div className="border-b border-black/5 dark:border-white/10 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Configuration</p>
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
            {/* AI Memory */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <BrainCircuitIcon className="size-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">AI Memory</h3>
                  <Badge variant="secondary" className="text-xs">{facts.length} facts</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="memory-toggle" className="text-sm text-muted-foreground">
                    {prefs.memoryEnabled ? 'On' : 'Off'}
                  </label>
                  <Switch
                    id="memory-toggle"
                    checked={prefs.memoryEnabled}
                    onCheckedChange={(v) => void updatePref({ memoryEnabled: v })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                The AI learns facts about you (role, expertise, preferences) from your conversations and uses them to personalize future responses.
              </p>

              {isLoadingFacts ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : facts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No facts stored yet. Start chatting to build your memory.</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="flex items-start gap-3 rounded-lg border border-black/5 dark:border-white/10 bg-white/50 dark:bg-zinc-800/30 px-3 py-2.5"
                      >
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[fact.category] ?? 'bg-muted text-muted-foreground'}`}>
                          {CATEGORY_LABELS[fact.category] ?? fact.category}
                        </span>
                        <p className="flex-1 text-sm text-foreground">{fact.fact}</p>
                        <button
                          type="button"
                          onClick={() => void deleteFact(fact.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete fact"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void clearAllFacts()}
                    disabled={isDeletingAll}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="mr-2 size-3.5" />
                    {isDeletingAll ? 'Clearing…' : 'Clear all facts'}
                  </Button>
                </>
              )}
            </section>

            {/* Prompt Enhancement */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Prompt Enhancement</h3>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="enhance-toggle" className="text-sm text-muted-foreground">
                    {prefs.promptEnhancementEnabled ? 'On' : 'Off'}
                  </label>
                  <Switch
                    id="enhance-toggle"
                    checked={prefs.promptEnhancementEnabled}
                    onCheckedChange={(v) => void updatePref({ promptEnhancementEnabled: v })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Before sending your message, a fast AI rewrites it to be more specific, add context, and clarify output format — while keeping your original intent. Your message is displayed unchanged; only the model sees the improved version.
              </p>
            </section>

            {/* Link to Models */}
            <section className="border-t border-black/5 dark:border-white/10 pt-6">
              <Button variant="outline" size="sm" asChild>
                <Link href="/models">
                  <BrainCircuitIcon className="mr-2 size-4" />
                  Manage enabled models →
                </Link>
              </Button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
