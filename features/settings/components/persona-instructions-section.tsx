'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ScanTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { systemPromptList } from '@/lib/prompt';

type Props = {
  personaInstructions: Record<string, string>;
  onSave: (key: string, value: string) => Promise<void>;
};

export function PersonaInstructionsSection({ personaInstructions, onSave }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const openEdit = (key: string) => {
    setEditing(key);
    setEditValue(personaInstructions[key] ?? '');
  };

  const cancelEdit = () => setEditing(null);

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await onSave(key, editValue.trim());
      setEditing(null);
    } finally {
      setSaving(null);
    }
  };

  return (
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
          const isEditing = editing === key;
          return (
            <div key={key} className="rounded-lg border border-black/5 dark:border-border overflow-hidden">
              <button
                type="button"
                onClick={() => isEditing ? cancelEdit() : openEdit(key)}
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
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                    placeholder={`Extra rules for ${label}...\ne.g. "Always respond in Thai" or "Prefer functional style"`}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleSave(key)} disabled={saving === key}>
                      {saving === key ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                    {hasInstructions && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => { setEditValue(''); void handleSave(key); }}
                        disabled={saving === key}
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
  );
}
