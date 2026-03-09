'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrainCircuitIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, GitMergeIcon, PencilIcon, SparklesIcon, Trash2Icon, WrenchIcon, XIcon } from 'lucide-react';
import { TOOL_REGISTRY, ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads, setNewChatIntent } from '@/features/chat/hooks/use-threads';
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
  enabledToolIds: string[] | null; // null = all tools enabled
};

const CATEGORY_ORDER = ['expertise', 'preference', 'context', 'goal'] as const;

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

function normalizeFact(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
}

export default function SettingsPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({ memoryEnabled: true, promptEnhancementEnabled: true, enabledToolIds: null });
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ ...CATEGORY_ORDER.reduce((acc, cat) => ({ ...acc, [cat]: true }), {}) }); // default: all collapsed
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);

  const {
    activeThreadId,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    createThreadMutation,
    pinThreadMutation,
    renameThreadMutation,
    deleteThreadMutation,
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

  // Which tool IDs are currently enabled (null means all)
  const effectiveToolIds: string[] = prefs.enabledToolIds ?? ALL_TOOL_IDS;

  const toggleTool = async (toolId: ToolId, enabled: boolean) => {
    const next = enabled
      ? [...effectiveToolIds, toolId]
      : effectiveToolIds.filter((id) => id !== toolId);
    // If all tools are enabled, store null (cleaner default)
    const value = next.length === ALL_TOOL_IDS.length ? null : next;
    await updatePref({ enabledToolIds: value });
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

  const startEdit = (fact: MemoryFact) => {
    setEditingId(fact.id);
    setEditValue(fact.fact);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const cancelEdit = () => setEditingId(null);

  const saveFact = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, fact: trimmed } : f)));
    setEditingId(null);
    await fetch(`/api/user/memory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact: trimmed }),
    });
  };

  const consolidate = async () => {
    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const fact of [...facts].reverse()) {
      const norm = normalizeFact(fact.fact);
      if (seen.has(norm)) {
        toDelete.push(fact.id);
      } else {
        seen.set(norm, fact.id);
      }
    }
    if (toDelete.length === 0) return;
    setFacts((prev) => prev.filter((f) => !toDelete.includes(f.id)));
    await Promise.all(toDelete.map((id) => fetch(`/api/user/memory/${id}`, { method: 'DELETE' })));
  };

  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const grouped: Array<{ category: string; facts: MemoryFact[] }> = CATEGORY_ORDER
    .map((cat) => ({ category: cat, facts: facts.filter((f) => f.category === cat) }))
    .filter((g) => g.facts.length > 0);

  // also catch any facts with unknown categories
  const knownCats = new Set(CATEGORY_ORDER as readonly string[]);
  const otherFacts = facts.filter((f) => !knownCats.has(f.category));
  if (otherFacts.length > 0) grouped.push({ category: 'other', facts: otherFacts });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7f7f9,#eef0f7_55%,#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-3 px-2 py-2 md:gap-6 md:px-4 md:py-6">
        <ChatSidebar
          activeThreadId={activeThreadId}
          threads={threads}
          isLoading={isThreadsLoading}
          isCreatingThread={createThreadMutation.isPending}
          onSelectThread={(threadId) => { setActiveThreadId(threadId); router.push('/'); }}
          onCreateThread={() => { setNewChatIntent(); router.push('/'); }}
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
                  <div className="space-y-3 mb-4">
                    {grouped.map(({ category, facts: catFacts }) => (
                      <div key={category} className="rounded-lg border border-black/5 dark:border-white/10 overflow-hidden">
                        {/* Category header */}
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-black/2 dark:bg-white/3 hover:bg-black/4 dark:hover:bg-white/5 transition-colors"
                        >
                          {collapsed[category]
                            ? <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />}
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground'}`}>
                            {CATEGORY_LABELS[category] ?? category}
                          </span>
                          <span className="text-xs text-muted-foreground">{catFacts.length}</span>
                        </button>

                        {/* Facts list */}
                        {!collapsed[category] && (
                          <div className="divide-y divide-black/5 dark:divide-white/5">
                            {catFacts.map((fact) => (
                              <div key={fact.id} className="flex items-start gap-2 px-3 py-2 bg-white/50 dark:bg-zinc-800/20 group">
                                {editingId === fact.id ? (
                                  <>
                                    <textarea
                                      ref={editRef}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveFact(fact.id); }
                                        if (e.key === 'Escape') cancelEdit();
                                      }}
                                      rows={2}
                                      className="flex-1 text-sm bg-transparent border border-black/10 dark:border-white/10 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20"
                                    />
                                    <div className="flex flex-col gap-1 shrink-0">
                                      <button type="button" onClick={() => void saveFact(fact.id)} className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors" aria-label="Save">
                                        <CheckIcon className="size-3.5" />
                                      </button>
                                      <button type="button" onClick={cancelEdit} className="rounded p-1 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors" aria-label="Cancel">
                                        <XIcon className="size-3.5" />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <p className="flex-1 text-sm text-foreground">{fact.fact}</p>
                                    <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button type="button" onClick={() => startEdit(fact)} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit fact">
                                        <PencilIcon className="size-3.5" />
                                      </button>
                                      <button type="button" onClick={() => void deleteFact(fact.id)} className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors" aria-label="Delete fact">
                                        <Trash2Icon className="size-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void consolidate()}
                    >
                      <GitMergeIcon className="mr-2 size-3.5" />
                      Consolidate duplicates
                    </Button>
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
                  </div>
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

            {/* Tools */}
            <section className="border-t border-black/5 dark:border-white/10 pt-6">
              <div className="flex items-center gap-2 mb-1">
                <WrenchIcon className="size-5 text-muted-foreground" />
                <h3 className="text-base font-semibold">AI Tools</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Choose which tools the AI can use during chat. Disabling tools reduces token usage and keeps the AI focused.
              </p>

              {/* Group tools by group label */}
              {(['utilities', 'knowledge', 'productivity'] as const).map((group) => {
                const groupTools = ALL_TOOL_IDS.filter((id) => TOOL_REGISTRY[id].group === group);
                if (groupTools.length === 0) return null;
                const groupLabel = { utilities: 'Utilities', knowledge: 'Knowledge', productivity: 'Productivity' }[group];
                return (
                  <div key={group} className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{groupLabel}</p>
                    <div className="space-y-2">
                      {groupTools.map((toolId) => {
                        const entry = TOOL_REGISTRY[toolId];
                        const isEnabled = effectiveToolIds.includes(toolId);
                        return (
                          <div key={toolId} className="flex items-start justify-between gap-4 rounded-lg border border-black/5 dark:border-white/10 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{entry.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(v) => void toggleTool(toolId as ToolId, v)}
                              className="shrink-0 mt-0.5"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
