'use client';

import { useState, useMemo } from 'react';
import { SearchIcon, ArrowLeftIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePrompts, useIncrementPromptUsage } from '../hooks/use-prompts';
import { PROMPT_CATEGORIES } from '../constants';
import type { Prompt } from '../types';

// Extract {{variable}} placeholders from prompt content
function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{([^}]+)\}\}/g);
  const seen = new Set<string>();
  const vars: string[] = [];
  for (const match of matches) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      vars.push(name);
    }
  }
  return vars;
}

function fillVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, name: string) => values[name.trim()] ?? `{{${name}}}`);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (text: string) => void;
};

export function PromptPickerModal({ open, onOpenChange, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [step, setStep] = useState<'browse' | 'fill'>('browse');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  const { data: prompts = [], isLoading } = usePrompts();
  const incrementUsage = useIncrementPromptUsage();

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [prompts, search, activeCategory]);

  const handlePickPrompt = (prompt: Prompt) => {
    const vars = extractVariables(prompt.content);
    if (vars.length > 0) {
      setSelectedPrompt(prompt);
      setVarValues(Object.fromEntries(vars.map((v) => [v, ''])));
      setStep('fill');
    } else {
      incrementUsage.mutate(prompt.id);
      onSelect(prompt.content);
      handleClose();
    }
  };

  const handleConfirmVariables = () => {
    if (!selectedPrompt) return;
    const resolved = fillVariables(selectedPrompt.content, varValues);
    incrementUsage.mutate(selectedPrompt.id);
    onSelect(resolved);
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep('browse');
      setSearch('');
      setActiveCategory('All');
      setSelectedPrompt(null);
      setVarValues({});
    }, 200);
  };

  const variables = selectedPrompt ? extractVariables(selectedPrompt.content) : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0">
        {step === 'browse' ? (
          <>
            <DialogHeader className="border-b border-black/5 dark:border-border px-4 pt-4 pb-3">
              <DialogTitle>Prompt library</DialogTitle>
              <div className="relative mt-2">
                <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search prompts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </DialogHeader>

            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-black/5 dark:border-border px-4 py-2">
              {['All', ...PROMPT_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>

            <ScrollArea className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No prompts found.</div>
              ) : (
                <div className="divide-y divide-black/5 dark:divide-border">
                  {filtered.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handlePickPrompt(prompt)}
                      className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm leading-snug">{prompt.title}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {prompt.isBuiltIn && (
                            <SparklesIcon className="size-3 text-amber-500" />
                          )}
                          <Badge variant="secondary" className="text-[11px]">{prompt.category}</Badge>
                        </div>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{prompt.content}</p>
                      {prompt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prompt.tags.map((tag) => (
                            <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-black/5 dark:border-border px-4 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => setStep('browse')}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <DialogTitle className="text-base">{selectedPrompt?.title}</DialogTitle>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4 overflow-auto p-4">
              <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground leading-relaxed">
                {selectedPrompt?.content}
              </p>

              <div className="space-y-3">
                <p className="text-sm font-medium">Fill in the variables</p>
                {variables.map((varName) => (
                  <div key={varName} className="space-y-1.5">
                    <Label htmlFor={`var-${varName}`} className="text-xs font-medium">
                      {varName.replace(/_/g, ' ')}
                    </Label>
                    <Input
                      id={`var-${varName}`}
                      value={varValues[varName] ?? ''}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [varName]: e.target.value }))
                      }
                      placeholder={`Enter ${varName.replace(/_/g, ' ')}…`}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={handleConfirmVariables} className="self-end">
                Use prompt
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
