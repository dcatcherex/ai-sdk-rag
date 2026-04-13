'use client';

import { useState } from 'react';
import { KeyRoundIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  credentials: Record<string, string>;
  onSave: (credentials: Record<string, string>) => Promise<void>;
};

type Entry = { key: string; value: string };

function credentialsToEntries(creds: Record<string, string>): Entry[] {
  return Object.entries(creds).map(([key, value]) => ({ key, value }));
}

function entriesToCredentials(entries: Entry[]): Record<string, string> {
  return Object.fromEntries(
    entries.filter((e) => e.key.trim()).map((e) => [e.key.trim(), e.value]),
  );
}

export function McpCredentialsSection({ credentials, onSave }: Props) {
  const [entries, setEntries] = useState<Entry[]>(() => credentialsToEntries(credentials));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const updateEntry = (index: number, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    setIsDirty(true);
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const addEntry = () => {
    if (!draftKey.trim()) return;
    setEntries((prev) => [...prev, { key: draftKey.trim(), value: draftValue }]);
    setDraftKey('');
    setDraftValue('');
    setShowAdd(false);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(entriesToCredentials(entries));
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border-t border-black/5 dark:border-border pt-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRoundIcon className="size-5 text-muted-foreground" />
        <h3 className="text-base font-semibold">MCP Credentials</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Store API keys and tokens for your MCP servers. Reference them by key name when configuring
        MCP servers in an agent. Credentials are stored in your user preferences and are never
        shared.
      </p>

      {entries.length > 0 && (
        <div className="space-y-2 mb-4">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-border px-3 py-2"
            >
              <Input
                className="h-8 w-48 shrink-0 font-mono text-xs"
                value={entry.key}
                onChange={(e) => updateEntry(i, { key: e.target.value })}
                placeholder="key_name"
              />
              <Input
                className="h-8 flex-1 font-mono text-xs"
                type="password"
                value={entry.value}
                onChange={(e) => updateEntry(i, { value: e.target.value })}
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeEntry(i)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground italic mb-4">No MCP credentials saved.</p>
      )}

      {showAdd ? (
        <div className="space-y-3 rounded-lg border border-black/5 bg-muted/30 p-4 dark:border-border mb-4">
          <p className="text-sm font-medium">Add Credential</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key name</Label>
              <Input
                className="font-mono text-xs"
                placeholder="e.g. doae_api_key"
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value.replace(/\s/g, '_'))}
              />
              <p className="text-xs text-muted-foreground">Used in the agent MCP server config</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secret value</Label>
              <Input
                className="font-mono text-xs"
                type="password"
                placeholder="••••••••"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={addEntry}
              disabled={!draftKey.trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAdd(false);
                setDraftKey('');
                setDraftValue('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 mb-4"
          onClick={() => setShowAdd(true)}
        >
          <PlusIcon className="size-3.5" />
          Add credential
        </Button>
      )}

      {isDirty && (
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save credentials'}
        </Button>
      )}
    </section>
  );
}
