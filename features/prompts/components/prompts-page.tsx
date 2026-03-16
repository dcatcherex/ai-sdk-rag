'use client';

import { useState } from 'react';
import {
  PlusIcon,
  SearchIcon,
  PencilIcon,
  TrashIcon,
  CopyIcon,
  GlobeIcon,
  LockIcon,
  SparklesIcon,
  LayoutGridIcon,
  TableIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  usePrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
} from '../hooks/use-prompts';
import { PromptForm } from './prompt-form';
import { PROMPT_CATEGORIES } from '../constants';
import type { Prompt } from '../types';

type ViewMode = 'card' | 'table';

// ── Card view ─────────────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onCopy,
  onEdit,
  onDelete,
}: {
  prompt: Prompt;
  onCopy: (content: string) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-black/5 dark:border-border bg-background p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {prompt.isBuiltIn && (
            <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          )}
          <p className="font-medium text-sm leading-snug truncate">{prompt.title}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[11px]">{prompt.category}</Badge>
      </div>

      <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed flex-1">
        {prompt.content}
      </p>

      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {prompt.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-black/5 dark:border-border pt-2.5">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {prompt.isPublic ? (
            <><GlobeIcon className="size-3" /> Public</>
          ) : (
            <><LockIcon className="size-3" /> Private</>
          )}
          {prompt.usageCount > 0 && (
            <span className="ml-2">{prompt.usageCount} uses</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onCopy(prompt.content)}
            title="Copy"
          >
            <CopyIcon className="size-3" />
          </Button>
          {!prompt.isBuiltIn && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => onEdit(prompt)}
                title="Edit"
              >
                <PencilIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                onClick={() => onDelete(prompt.id)}
                title="Delete"
              >
                <TrashIcon className="size-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromptsPage() {
  const { data: prompts = [], isLoading } = usePrompts();
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [createOpen, setCreateOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = prompts.filter((p) => {
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (content: string) => {
    void navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-black/5 dark:border-border px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Prompt Library</h1>
            <p className="text-sm text-muted-foreground">
              Save and reuse your best prompts across conversations.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <PlusIcon className="mr-1.5 size-4" />
            New prompt
          </Button>
        </div>

        {/* Filters + view toggle */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search prompts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PROMPT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center rounded-md border border-black/10 dark:border-border">
            <Button
              variant="ghost"
              size="icon"
              className={[
                'size-8 rounded-r-none border-r border-black/10 dark:border-border',
                viewMode === 'card' ? 'bg-muted' : '',
              ].join(' ')}
              onClick={() => setViewMode('card')}
              title="Card view"
            >
              <LayoutGridIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={[
                'size-8 rounded-l-none',
                viewMode === 'table' ? 'bg-muted' : '',
              ].join(' ')}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <TableIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>No prompts found.</p>
            {!search && categoryFilter === 'all' && (
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                Create your first prompt
              </Button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onCopy={handleCopy}
                onEdit={setEditPrompt}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-[80px] text-right">Uses</TableHead>
                <TableHead className="w-[90px]">Scope</TableHead>
                <TableHead className="w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell>
                    <div className="flex items-start gap-1.5">
                      {prompt.isBuiltIn && (
                        <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm leading-snug">{prompt.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {prompt.content}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{prompt.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[11px] text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {prompt.usageCount}
                  </TableCell>
                  <TableCell>
                    {prompt.isPublic ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GlobeIcon className="size-3.5" /> Public
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <LockIcon className="size-3.5" /> Private
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleCopy(prompt.content)}
                        title="Copy"
                      >
                        <CopyIcon className="size-3.5" />
                      </Button>
                      {!prompt.isBuiltIn && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setEditPrompt(prompt)}
                            title="Edit"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(prompt.id)}
                            title="Delete"
                          >
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create dialog */}
      {createOpen && (
        <PromptForm
          key="create"
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          isPending={createPrompt.isPending}
          onSubmit={(data) => {
            createPrompt.mutate(data, { onSuccess: () => setCreateOpen(false) });
          }}
        />
      )}

      {/* Edit dialog */}
      {editPrompt && (
        <PromptForm
          key={editPrompt.id}
          mode="edit"
          open={!!editPrompt}
          onOpenChange={(open) => { if (!open) setEditPrompt(null); }}
          prompt={editPrompt}
          isPending={updatePrompt.isPending}
          onSubmit={(data) => {
            updatePrompt.mutate(data, { onSuccess: () => setEditPrompt(null) });
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deletePrompt.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
