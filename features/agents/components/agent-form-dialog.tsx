'use client';

import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { availableModels } from '@/lib/ai';
import { TOOL_REGISTRY } from '@/lib/tool-registry';
import { useUserDocuments } from '../hooks/use-agent-documents';
import { useUserSearch } from '../hooks/use-user-search';
import type { Agent, AgentWithSharing, CreateAgentInput, SharedUser } from '../types';

type AgentFormDialogProps = {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSubmit: (data: CreateAgentInput) => void;
  isPending?: boolean;
};

export const AgentFormDialog = ({
  open,
  agent,
  onClose,
  onSubmit,
  isPending,
}: AgentFormDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelId, setModelId] = useState<string>('auto');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [shareSearch, setShareSearch] = useState('');

  const { data: userDocuments = [], isLoading: docsLoading } = useUserDocuments();
  const { data: searchResults = [] } = useUserSearch(shareSearch);

  const filteredDocuments = docSearch.trim()
    ? userDocuments.filter((d) => {
        const title = (d.metadata?.title as string) ?? d.id;
        return title.toLowerCase().includes(docSearch.toLowerCase());
      })
    : userDocuments;

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description ?? '');
      setSystemPrompt(agent.systemPrompt);
      setModelId(agent.modelId ?? 'auto');
      setEnabledTools(agent.enabledTools ?? []);
      setDocumentIds(agent.documentIds ?? []);
      setIsPublic(agent.isPublic ?? false);
      setSharedWith((agent as AgentWithSharing).sharedWith ?? []);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setModelId('auto');
      setEnabledTools([]);
      setDocumentIds([]);
      setIsPublic(false);
      setSharedWith([]);
    }
    setDocSearch('');
    setShareSearch('');
  }, [agent, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim(),
      modelId: modelId === 'auto' ? null : modelId,
      enabledTools,
      documentIds,
      isPublic,
      sharedUserIds: sharedWith.map((u) => u.id),
    });
  };

  const toggleTool = (toolId: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const addToShared = (user: SharedUser) => {
    setSharedWith((prev) => (prev.find((u) => u.id === user.id) ? prev : [...prev, user]));
    setShareSearch('');
  };

  const removeFromShared = (userId: string) => {
    setSharedWith((prev) => prev.filter((u) => u.id !== userId));
  };

  const unaddedResults = searchResults.filter((u) => !sharedWith.find((s) => s.id === u.id));
  const showNoResults = shareSearch.trim().length >= 2 && searchResults.length === 0;
  const isValid = name.trim().length > 0 && systemPrompt.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name *</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Helper"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-description">Description</Label>
            <Input
              id="agent-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt">System Prompt *</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert..."
              className="min-h-28 resize-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preferred Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto (recommended)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (recommended)</SelectItem>
                {availableModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tools</Label>
            {Object.entries(TOOL_REGISTRY).map(([id, meta]) => (
              <div key={id} className="flex items-start gap-2">
                <Checkbox
                  id={`tool-${id}`}
                  checked={enabledTools.includes(id)}
                  onCheckedChange={() => toggleTool(id)}
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor={`tool-${id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {meta.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Knowledge Documents</Label>
            <p className="text-xs text-muted-foreground">
              These documents are automatically used when this agent is active — no manual selection needed.
            </p>
            {docsLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : userDocuments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No documents yet. Upload in the Knowledge section.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Input
                  placeholder="Search documents…"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="max-h-40 overflow-y-auto rounded-md border border-black/5 dark:border-white/10 p-1 space-y-0.5">
                  {filteredDocuments.map((doc) => {
                    const title = (doc.metadata?.title as string | undefined) ?? doc.id;
                    const checked = documentIds.includes(doc.id);
                    return (
                      <div key={doc.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                        <Checkbox
                          id={`doc-${doc.id}`}
                          checked={checked}
                          onCheckedChange={(v) =>
                            setDocumentIds((prev) =>
                              v ? [...prev, doc.id] : prev.filter((d) => d !== doc.id)
                            )
                          }
                        />
                        <label
                          htmlFor={`doc-${doc.id}`}
                          className="text-xs leading-none cursor-pointer truncate"
                          title={title}
                        >
                          {title}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {documentIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {documentIds.length} document{documentIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="agent-public" className="text-sm font-medium cursor-pointer">
                Share publicly
              </Label>
              <p className="text-xs text-muted-foreground">
                All users on this platform can see and use this agent.
              </p>
            </div>
            <Switch id="agent-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* Targeted share */}
          <div className="space-y-2">
            <Label>Share with specific people</Label>
            <p className="text-xs text-muted-foreground">
              Search for a registered user by name or email, then click to add them.
            </p>

            {/* Current shared list */}
            {sharedWith.length > 0 && (
              <div className="space-y-1">
                {sharedWith.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{u.email}</span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      onClick={() => removeFromShared(u.id)}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Search to add */}
            <Input
              placeholder="Search by name or email…"
              value={shareSearch}
              onChange={(e) => setShareSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {unaddedResults.length > 0 && (
              <div className="rounded-md border border-black/5 dark:border-white/10 p-1 space-y-0.5 max-h-32 overflow-y-auto">
                {unaddedResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 text-left"
                    onClick={() => addToShared(u)}
                  >
                    <span className="text-xs font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
            {showNoResults && (
              <p className="text-xs text-muted-foreground px-1">
                No registered users found for &ldquo;{shareSearch.trim()}&rdquo;. Only users with an existing account can be added.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Saving…' : agent ? 'Save changes' : 'Create agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
