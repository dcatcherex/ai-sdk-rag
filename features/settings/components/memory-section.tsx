'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuitIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, GitMergeIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { MemoryFact, Preferences } from '../types';

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

type Props = {
  prefs: Preferences;
  onUpdatePref: (patch: Partial<Preferences>) => Promise<void>;
};

export function MemorySection({ prefs, onUpdatePref }: Props) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    CATEGORY_ORDER.reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('preference');
  const [isSubmittingFact, setIsSubmittingFact] = useState(false);
  const addFactRef = useRef<HTMLTextAreaElement>(null);

  const loadFacts = useCallback(async () => {
    setIsLoadingFacts(true);
    try {
      const res = await fetch('/api/user/memory');
      if (res.ok) setFacts(await res.json());
    } finally {
      setIsLoadingFacts(false);
    }
  }, []);

  useEffect(() => { void loadFacts(); }, [loadFacts]);

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

  const cancelAddFact = () => { setIsAddingFact(false); setNewFactText(''); };

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
      if (seen.has(norm)) toDelete.push(fact.id);
      else seen.set(norm, fact.id);
    }
    if (toDelete.length === 0) return;
    setFacts((prev) => prev.filter((f) => !toDelete.includes(f.id)));
    await Promise.all(toDelete.map((id) => fetch(`/api/user/memory/${id}`, { method: 'DELETE' })));
  };

  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const knownCats = new Set(CATEGORY_ORDER as readonly string[]);
  const grouped = [
    ...CATEGORY_ORDER
      .map((cat) => ({ category: cat, facts: facts.filter((f) => f.category === cat) }))
      .filter((g) => g.facts.length > 0),
    ...(facts.filter((f) => !knownCats.has(f.category)).length > 0
      ? [{ category: 'other', facts: facts.filter((f) => !knownCats.has(f.category)) }]
      : []),
  ];

  return (
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
          {CATEGORY_GUIDES[newFactCategory] && (
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

      {/* Memory sub-toggles */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Personalized Context</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inject your stored facts into each conversation so the AI responds with your context in mind.</p>
          </div>
          <Switch
            id="memory-inject-toggle"
            checked={prefs.memoryInjectEnabled}
            onCheckedChange={(v) => void onUpdatePref({ memoryInjectEnabled: v })}
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
            onCheckedChange={(v) => void onUpdatePref({ memoryExtractEnabled: v })}
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
            <Button variant="outline" size="sm" onClick={() => void consolidate()}>
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
  );
}
