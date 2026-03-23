'use client';

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { GroupPerson, RecipientGroup } from '../../types';

type Props = {
  group?: RecipientGroup;
  onSave: (data: { name: string; description?: string; recipients: GroupPerson[] }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
};

function getInitialColumns(group?: RecipientGroup): string[] {
  if (!group || group.recipients.length === 0) return ['name'];
  const keys = new Set<string>();
  for (const person of group.recipients) {
    for (const key of Object.keys(person.values)) {
      keys.add(key);
    }
  }
  return keys.size > 0 ? Array.from(keys) : ['name'];
}

function parsePaste(text: string): { columns: string[]; people: GroupPerson[] } | null {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  const headers = lines[0].split('\t').map(h => h.trim()).filter(Boolean);
  if (headers.length === 0) return null;
  const people = lines.slice(1).map(line => ({
    id: nanoid(),
    values: Object.fromEntries(
      line.split('\t').map((cell, i) => [headers[i] ?? `col${i}`, cell.trim()])
    ),
  }));
  return { columns: headers, people };
}

export function GroupEditor({ group, onSave, onCancel, isSaving }: Props) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [columns, setColumns] = useState<string[]>(getInitialColumns(group));
  const [people, setPeople] = useState<GroupPerson[]>(
    group?.recipients && group.recipients.length > 0
      ? group.recipients
      : [{ id: nanoid(), values: {} }]
  );
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addColumn() {
    setColumns(prev => [...prev, `col${prev.length + 1}`]);
  }

  function removeColumn(ci: number) {
    const colId = columns[ci];
    setColumns(prev => prev.filter((_, i) => i !== ci));
    setPeople(prev =>
      prev.map(person => {
        const { [colId]: _removed, ...rest } = person.values;
        return { ...person, values: rest };
      })
    );
  }

  function updateColumn(ci: number, value: string) {
    const oldKey = columns[ci];
    const newKey = value;
    setColumns(prev => prev.map((col, i) => (i === ci ? newKey : col)));
    setPeople(prev =>
      prev.map(person => {
        const newValues: Record<string, string> = {};
        for (const [k, v] of Object.entries(person.values)) {
          newValues[k === oldKey ? newKey : k] = v;
        }
        return { ...person, values: newValues };
      })
    );
  }

  function addPerson() {
    setPeople(prev => [...prev, { id: nanoid(), values: {} }]);
  }

  function removePerson(pi: number) {
    setPeople(prev => prev.filter((_, i) => i !== pi));
  }

  function updateCell(pi: number, col: string, value: string) {
    setPeople(prev =>
      prev.map((person, i) =>
        i === pi ? { ...person, values: { ...person.values, [col]: value } } : person
      )
    );
  }

  function handleParsePaste() {
    const result = parsePaste(pasteText);
    if (!result) {
      setError('Could not parse paste — make sure it is tab-separated with a header row.');
      return;
    }
    setColumns(result.columns);
    setPeople(result.people);
    setPasteText('');
    setError(null);
  }

  async function handleSave() {
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        recipients: people,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-border">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">{group ? 'Edit group' : 'New group'}</h3>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* name + description */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Group name *</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Summer Camp 2026"
          />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional note"
          />
        </div>
      </div>

      {/* paste section */}
      <details className="rounded-lg border border-dashed border-zinc-200 p-3 dark:border-border">
        <summary className="cursor-pointer text-xs text-zinc-500">
          Paste from Google Sheets to import
        </summary>
        <div className="mt-2 space-y-2">
          <Textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"name\tnickname\nThirathat\tTop"}
            className="min-h-24 text-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleParsePaste}>
            Import
          </Button>
        </div>
      </details>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border dark:border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:border-border dark:bg-muted/50">
              <th className="w-8 px-3 py-2 text-left text-xs text-zinc-400">#</th>
              {columns.map((col, ci) => (
                <th key={ci} className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Input
                      value={col}
                      onChange={e => updateColumn(ci, e.target.value)}
                      className="h-7 text-xs font-mono"
                      placeholder="field_id"
                    />
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(ci)}
                        className="text-zinc-300 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8 px-2">
                <button
                  type="button"
                  onClick={addColumn}
                  className="text-zinc-400 hover:text-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, pi) => (
              <tr key={person.id} className="border-b last:border-0 dark:border-border">
                <td className="px-3 py-1 text-xs text-zinc-400">{pi + 1}</td>
                {columns.map((col, ci) => (
                  <td key={ci} className="px-2 py-1">
                    <Input
                      value={person.values[col] ?? ''}
                      onChange={e => updateCell(pi, col, e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                ))}
                <td className="px-2">
                  <button
                    type="button"
                    onClick={() => removePerson(pi)}
                    disabled={people.length === 1}
                    className="text-zinc-300 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={addPerson}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add person
        </Button>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Saving…' : 'Save group'}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
