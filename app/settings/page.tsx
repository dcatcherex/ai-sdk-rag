'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrainCircuitIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, GitMergeIcon, MessageCircleQuestionIcon, PencilIcon, PlusIcon, ScanTextIcon, SparklesIcon, Trash2Icon, WrenchIcon, XIcon } from 'lucide-react';
import { TOOL_REGISTRY, ALL_TOOL_IDS, type ToolId } from '@/lib/tool-registry';
import { systemPromptList, type SystemPromptKey } from '@/lib/prompt';
import { ChatSidebar } from '@/features/chat/components/chat-sidebar';
import { useThreads, setNewChatIntent } from '@/features/chat/hooks/use-threads';
import { useUserProfile } from '@/features/chat/hooks/use-user-profile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type MemoryFact = {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
};

type Preferences = {
  memoryEnabled: boolean;
  memoryInjectEnabled: boolean;
  memoryExtractEnabled: boolean;
  personaDetectionEnabled: boolean;
  promptEnhancementEnabled: boolean;
  followUpSuggestionsEnabled: boolean;
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

const CATEGORY_GUIDES: Record<string, { description: string; examples: string[] }> = {
  preference: {
    description: 'How you like the AI to behave or format responses.',
    examples: ['Always respond in Thai', 'Prefer concise answers without preamble', 'Use code comments in English'],
  },
  expertise: {
    description: 'Skills, technologies, or domains you know well.',
    examples: ['Senior React and Next.js developer', 'Familiar with Drizzle ORM and Neon', 'Has 5 years of backend experience'],
  },
  context: {
    description: 'Your role, company, or current project.',
    examples: ['CTO at a B2B SaaS startup', 'Working on an AI chat application', 'Team uses pnpm and Turbopack'],
  },
  goal: {
    description: 'What you are trying to achieve long-term.',
    examples: ['Launch an MVP within 3 months', 'Learn system design patterns', 'Improve AI product UX'],
  },
};

function normalizeFact(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
}

export default function SettingsPage() {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({ memoryEnabled: true, memoryInjectEnabled: true, memoryExtractEnabled: true, personaDetectionEnabled: true, promptEnhancementEnabled: true, followUpSuggestionsEnabled: true, enabledToolIds: null });
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [personaInstructions, setPersonaInstructions] = useState<Record<string, string>>({});
  const [personaEditing, setPersonaEditing] = useState<string | null>(null);
  const [personaEditValue, setPersonaEditValue] = useState('');
  const [personaSaving, setPersonaSaving] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ ...CATEGORY_ORDER.reduce((acc, cat) => ({ ...acc, [cat]: true }), {}) }); // default: all collapsed
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [newFactCategory, setNewFactCategory] = useState<string>('preference');
  const [isSubmittingFact, setIsSubmittingFact] = useState(false);
  const addFactRef = useRef<HTMLTextAreaElement>(null);

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
      const [factsRes, prefsRes, personaRes] = await Promise.all([
        fetch('/api/user/memory'),
        fetch('/api/user/preferences'),
        fetch('/api/user/persona-instructions'),
      ]);
      if (factsRes.ok) setFacts(await factsRes.json());
      if (prefsRes.ok) setPrefs(await prefsRes.json());
      if (personaRes.ok) setPersonaInstructions(await personaRes.json());
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

  const openPersonaEdit = (key: string) => {
    setPersonaEditing(key);
    setPersonaEditValue(personaInstructions[key] ?? '');
  };

  const cancelPersonaEdit = () => setPersonaEditing(null);

  const savePersonaInstructions = async (key: string) => {
    setPersonaSaving(key);
    try {
      const trimmed = personaEditValue.trim();
      await fetch('/api/user/persona-instructions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaKey: key, extraInstructions: trimmed }),
      });
      setPersonaInstructions((prev) => {
        const next = { ...prev };
        if (trimmed) next[key] = trimmed;
        else delete next[key];
        return next;
      });
      setPersonaEditing(null);
    } finally {
      setPersonaSaving(null);
    }
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

  const openAddFact = () => {
    setIsAddingFact(true);
    setNewFactText('');
    setNewFactCategory('preference');
    setTimeout(() => addFactRef.current?.focus(), 0);
  };

  const cancelAddFact = () => {
    setIsAddingFact(false);
    setNewFactText('');
  };

  const submitAddFact = async () => {
    const trimmed = newFactText.trim();
    if (!trimmed) return;
    setIsSubmittingFact(true);
    try {
      const res = await fetch('/api/user/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newFactCategory, fact: trimmed }),
      });
      if (res.ok) {
        const created = await res.json() as MemoryFact;
        setFacts((prev) => [created, ...prev]);
        setIsAddingFact(false);
        setNewFactText('');
      }
    } finally {
      setIsSubmittingFact(false);
    }
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
                {!isAddingFact && (
                  <Button variant="outline" size="sm" onClick={openAddFact}>
                    <PlusIcon className="mr-1.5 size-3.5" />
                    Add fact
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Stored facts about you (role, expertise, preferences) collected from your conversations.
              </p>

              {/* Inline add form */}
              {isAddingFact && (
                <div className="mb-4 rounded-lg border border-black/10 dark:border-white/10 bg-black/2 dark:bg-white/3 p-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_ORDER.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewFactCategory(cat)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-opacity ${CATEGORY_COLORS[cat]} ${newFactCategory === cat ? 'opacity-100' : 'opacity-40'}`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                  {newFactCategory && CATEGORY_GUIDES[newFactCategory] && (
                    <div className="rounded-md bg-black/3 dark:bg-white/4 px-3 py-2 space-y-1">
                      <p className="text-xs text-muted-foreground">{CATEGORY_GUIDES[newFactCategory].description}</p>
                      <div className="flex flex-wrap gap-1">
                        {CATEGORY_GUIDES[newFactCategory].examples.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => setNewFactText(ex)}
                            className="rounded border border-black/8 dark:border-white/10 bg-white/60 dark:bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 transition-colors"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    ref={addFactRef}
                    value={newFactText}
                    onChange={(e) => setNewFactText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submitAddFact(); }
                      if (e.key === 'Escape') cancelAddFact();
                    }}
                    placeholder="e.g. prefers concise answers without unnecessary preamble"
                    rows={2}
                    className="w-full text-sm bg-transparent border border-black/10 dark:border-white/10 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20 placeholder:text-muted-foreground/50"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void submitAddFact()} disabled={isSubmittingFact || !newFactText.trim()}>
                      {isSubmittingFact ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelAddFact}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Sub-toggles */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Personalized Context</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Inject your stored facts into each conversation so the AI responds with your context in mind.</p>
                  </div>
                  <Switch
                    id="memory-inject-toggle"
                    checked={prefs.memoryInjectEnabled}
                    onCheckedChange={(v) => void updatePref({ memoryInjectEnabled: v })}
                    className="shrink-0 ml-4"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Learn from Conversations</p>
                    <p className="text-xs text-muted-foreground mt-0.5">After each response, extract new facts about you and add them to memory.</p>
                  </div>
                  <Switch
                    id="memory-extract-toggle"
                    checked={prefs.memoryExtractEnabled}
                    onCheckedChange={(v) => void updatePref({ memoryExtractEnabled: v })}
                    className="shrink-0 ml-4"
                  />
                </div>
              </div>

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

            {/* Persona Detection */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <ScanTextIcon className="size-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Auto Persona</h3>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="persona-toggle" className="text-sm text-muted-foreground">
                    {prefs.personaDetectionEnabled ? 'On' : 'Off'}
                  </label>
                  <Switch
                    id="persona-toggle"
                    checked={prefs.personaDetectionEnabled}
                    onCheckedChange={(v) => void updatePref({ personaDetectionEnabled: v })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically detects the intent of your message (coding, research, writing, etc.) and switches the AI's system prompt to match. When off, the AI always uses the general assistant persona.
              </p>
            </section>

            {/* Persona Custom Instructions */}
            <section>
              <div className="flex items-center gap-2 mb-1">
                <ScanTextIcon className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">Custom instructions per persona</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Add your own rules that get appended to a persona's system prompt — only when that persona is active.
              </p>
              <div className="space-y-1.5">
                {systemPromptList.map(({ key, label }) => {
                  const hasInstructions = !!personaInstructions[key];
                  const isEditing = personaEditing === key;
                  return (
                    <div key={key} className="rounded-lg border border-black/5 dark:border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => isEditing ? cancelPersonaEdit() : openPersonaEdit(key)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-black/2 dark:hover:bg-white/3 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                          {hasInstructions && !isEditing && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium">Custom</span>
                          )}
                        </div>
                        {isEditing
                          ? <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                          : <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
                      </button>
                      {isEditing && (
                        <div className="px-3 pb-3 pt-1 space-y-2 bg-black/1 dark:bg-white/2">
                          <Textarea
                            value={personaEditValue}
                            onChange={(e) => setPersonaEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') cancelPersonaEdit(); }}
                            placeholder={`Extra rules for ${label}...\ne.g. "Always respond in Thai" or "Prefer functional style"`}
                            rows={3}
                            className="text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void savePersonaInstructions(key)}
                              disabled={personaSaving === key}
                            >
                              {personaSaving === key ? 'Saving…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelPersonaEdit}>Cancel</Button>
                            {hasInstructions && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive ml-auto"
                                onClick={() => { setPersonaEditValue(''); void savePersonaInstructions(key); }}
                                disabled={personaSaving === key}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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

            {/* Follow-up Suggestions */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestionIcon className="size-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Follow-up Suggestions</h3>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor="followup-toggle" className="text-sm text-muted-foreground">
                    {prefs.followUpSuggestionsEnabled ? 'On' : 'Off'}
                  </label>
                  <Switch
                    id="followup-toggle"
                    checked={prefs.followUpSuggestionsEnabled}
                    onCheckedChange={(v) => void updatePref({ followUpSuggestionsEnabled: v })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                After each response, the AI generates clickable follow-up question suggestions to help you continue the conversation.
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
