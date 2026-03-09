'use client';

import { useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon, UserCircle2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCustomPersonas, useCreateCustomPersona, useUpdateCustomPersona, useDeleteCustomPersona } from '@/features/chat/hooks/use-custom-personas';
import type { CustomPersona } from '@/features/chat/types/custom-persona';

export function CustomPersonasSection() {
  const { data: customPersonas = [] } = useCustomPersonas();
  const createMutation = useCreateCustomPersona();
  const updateMutation = useUpdateCustomPersona();
  const deleteMutation = useDeleteCustomPersona();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  const openEdit = (p: CustomPersona) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrompt(p.systemPrompt);
  };

  const cancelEdit = () => setEditingId(null);

  const submitCreate = async () => {
    const name = newName.trim();
    const systemPrompt = newPrompt.trim();
    if (!name || !systemPrompt) return;
    await createMutation.mutateAsync({ name, systemPrompt });
    setIsAdding(false);
    setNewName('');
    setNewPrompt('');
  };

  const submitEdit = async (id: string) => {
    const name = editName.trim();
    const systemPrompt = editPrompt.trim();
    if (!name || !systemPrompt) return;
    await updateMutation.mutateAsync({ id, name, systemPrompt });
    setEditingId(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <UserCircle2Icon className="size-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">Custom Personas</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setIsAdding(true); setNewName(''); setNewPrompt(''); }}>
          <PlusIcon className="size-3.5 mr-1" />
          New
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Create your own personas with a custom system prompt. Select them from the persona picker in the chat composer.
      </p>

      {isAdding && (
        <div className="rounded-lg border border-black/5 dark:border-white/10 p-3 mb-3 space-y-2 bg-black/1 dark:bg-white/2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Persona name (e.g. Thai Teacher)"
            maxLength={100}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="System prompt — describe how this persona should behave…"
            rows={4}
            maxLength={4000}
            className="text-sm resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void submitCreate()}
              disabled={createMutation.isPending || !newName.trim() || !newPrompt.trim()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {customPersonas.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">No custom personas yet.</p>
        )}
        {customPersonas.map((p) => (
          <div key={p.id} className="rounded-lg border border-black/5 dark:border-white/10 overflow-hidden">
            {editingId === p.id ? (
              <div className="px-3 py-3 space-y-2 bg-black/1 dark:bg-white/2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void submitEdit(p.id)}
                    disabled={updateMutation.isPending || !editName.trim() || !editPrompt.trim()}
                  >
                    {updateMutation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCircle2Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(p)}>
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => void deleteMutation.mutateAsync(p.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
