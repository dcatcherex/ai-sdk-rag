'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2Icon, PlusIcon, SparklesIcon, XIcon } from 'lucide-react';
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
import type { Brand } from '@/features/brands/types';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { Skill } from '@/features/skills/types';

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
  const [brandId, setBrandId] = useState<string>('none');
  const [docSearch, setDocSearch] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [starterInput, setStarterInput] = useState('');
  const starterInputRef = useRef<HTMLInputElement>(null);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);

  const { data: userDocuments = [], isLoading: docsLoading } = useUserDocuments();
  const { data: searchResults = [] } = useUserSearch(shareSearch);
  const { data: userSkills = [] } = useSkills();

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    })();
  }, []);

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
      setBrandId(agent.brandId ?? 'none');
      setIsPublic(agent.isPublic ?? false);
      setSharedWith((agent as AgentWithSharing).sharedWith ?? []);
      setSkillIds(agent.skillIds ?? []);
      setStarterPrompts(agent.starterPrompts ?? []);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setModelId('auto');
      setEnabledTools([]);
      setDocumentIds([]);
      setBrandId('none');
      setIsPublic(false);
      setSharedWith([]);
      setSkillIds([]);
      setStarterPrompts([]);
    }
    setStarterInput('');
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
      skillIds,
      brandId: brandId === 'none' ? null : brandId,
      isPublic,
      starterPrompts,
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

          {/* Conversation starters */}
          <div className="space-y-1.5">
            <Label>Conversation starters <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <p className="text-xs text-muted-foreground">
              Suggested prompts shown to users before their first message. Up to 4.
            </p>
            {starterPrompts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {starterPrompts.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/40 px-2.5 py-1 text-xs"
                  >
                    {s}
                    <button
                      type="button"
                      className="ml-0.5 text-muted-foreground hover:text-foreground transition"
                      onClick={() => setStarterPrompts((p) => p.filter((_, j) => j !== i))}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {starterPrompts.length < 4 && (
              <div className="flex gap-2">
                <Input
                  ref={starterInputRef}
                  value={starterInput}
                  onChange={(e) => setStarterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = starterInput.trim();
                      if (v && starterPrompts.length < 4) {
                        setStarterPrompts((p) => [...p, v]);
                        setStarterInput('');
                      }
                    }
                  }}
                  placeholder="e.g. What can you help me with?"
                  maxLength={100}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={!starterInput.trim()}
                  onClick={() => {
                    const v = starterInput.trim();
                    if (v) {
                      setStarterPrompts((p) => [...p, v]);
                      setStarterInput('');
                      starterInputRef.current?.focus();
                    }
                  }}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            )}
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

          {brands.length > 0 && (
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Building2Icon className="size-3.5" />
                      No brand
                    </span>
                  </SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full shrink-0"
                          style={{ background: b.colors[0]?.hex ?? 'hsl(var(--muted))' }}
                        />
                        {b.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Brand context is automatically injected into this agent&apos;s system prompt.
              </p>
            </div>
          )}

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

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills</Label>
            <p className="text-xs text-muted-foreground">
              Skills extend this agent with reusable prompt behaviors triggered by slash commands or keywords.
            </p>
            {userSkills.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No skills yet. Create skills in the Skills section.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border border-black/5 dark:border-border p-1 space-y-0.5">
                {userSkills.filter((s: Skill) => s.userId === s.userId).map((skill: Skill) => {
                  const checked = skillIds.includes(skill.id);
                  const triggerLabel =
                    skill.triggerType === 'always'
                      ? 'always'
                      : skill.trigger
                        ? `${skill.triggerType === 'slash' ? '' : ''}${skill.trigger}`
                        : skill.triggerType;
                  return (
                    <div key={skill.id} className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        id={`skill-${skill.id}`}
                        checked={checked}
                        onChange={() =>
                          setSkillIds((prev) =>
                            checked ? prev.filter((id) => id !== skill.id) : [...prev, skill.id]
                          )
                        }
                        className="mt-0.5 size-3.5 rounded border accent-primary cursor-pointer"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <label
                          htmlFor={`skill-${skill.id}`}
                          className="flex items-center gap-1.5 text-xs font-medium leading-none cursor-pointer"
                        >
                          <SparklesIcon className="size-3 shrink-0 text-primary" />
                          {skill.name}
                          <span className="text-muted-foreground font-normal">· {triggerLabel}</span>
                        </label>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {skillIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {skillIds.length} skill{skillIds.length !== 1 ? 's' : ''} attached
              </p>
            )}
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
                <div className="max-h-40 overflow-y-auto rounded-md border border-black/5 dark:border-border p-1 space-y-0.5">
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
          <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-border p-3">
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
              <div className="rounded-md border border-black/5 dark:border-border p-1 space-y-0.5 max-h-32 overflow-y-auto">
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
