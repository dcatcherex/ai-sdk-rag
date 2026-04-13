'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  BotIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  Trash2Icon,
} from 'lucide-react';

import { availableModels } from '@/lib/ai';
import { getAgentManifests } from '@/features/tools/registry/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

type AdminAgent = {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  modelId: string | null;
  enabledTools: string[];
  starterPrompts: string[];
  imageUrl: string | null;
  cloneBehavior: 'locked' | 'editable_copy';
  updatePolicy: 'none' | 'notify' | 'auto_for_locked';
  lockedFields: string[];
  changelog: string | null;
  catalogStatus: 'draft' | 'published' | 'archived';
  version: number;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

type AgentsResponse = {
  agents: AdminAgent[];
};

type AgentFormState = {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  enabledTools: string[];
  starterPromptsText: string;
  imageUrl: string;
  cloneBehavior: 'locked' | 'editable_copy';
  updatePolicy: 'none' | 'notify' | 'auto_for_locked';
  lockedFields: string[];
  changelog: string;
};

const AGENT_LOCK_FIELDS = [
  'systemPrompt',
  'enabledTools',
  'modelId',
  'brandId',
  'documentIds',
  'starterPrompts',
] as const;

const agentToolManifests = getAgentManifests();

const emptyForm = (): AgentFormState => ({
  name: '',
  description: '',
  systemPrompt: '',
  modelId: 'auto',
  enabledTools: [],
  starterPromptsText: '',
  imageUrl: '',
  cloneBehavior: 'editable_copy',
  updatePolicy: 'notify',
  lockedFields: [],
  changelog: '',
});

const toFormState = (agent: AdminAgent | null): AgentFormState => {
  if (!agent) return emptyForm();
  return {
    name: agent.name,
    description: agent.description ?? '',
    systemPrompt: agent.systemPrompt,
    modelId: agent.modelId ?? 'auto',
    enabledTools: agent.enabledTools,
    starterPromptsText: agent.starterPrompts.join('\n'),
    imageUrl: agent.imageUrl ?? '',
    cloneBehavior: agent.cloneBehavior,
    updatePolicy: agent.updatePolicy,
    lockedFields: agent.lockedFields,
    changelog: agent.changelog ?? '',
  };
};

const parseStarterPrompts = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

async function uploadAdminAgentCover(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/agents/image', { method: 'POST', body: formData });
  const json = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Upload failed');
  return json.url ?? '';
}

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

function StatusBadge({ status }: { status: AdminAgent['catalogStatus'] }) {
  if (status === 'published') return <Badge variant="secondary">Published</Badge>;
  if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function AdminAgentsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AdminAgent | null>(null);
  const [form, setForm] = useState<AgentFormState>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AgentsResponse>({
    queryKey: ['admin', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to load admin agents');
      return res.json();
    },
  });

  useEffect(() => {
    setForm(toFormState(editingAgent));
  }, [editingAgent]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; body: Record<string, unknown> }) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch(isEdit ? `/api/admin/agents/${payload.id}` : '/api/admin/agents', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ agent: AdminAgent }>;
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingAgent(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (agent: AdminAgent) => {
      const res = await fetch(`/api/admin/agents/${agent.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changelog: agent.changelog }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/agents/${id}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      setDeleteConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });

  const sortedAgents = useMemo(
    () => [...(data?.agents ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data?.agents],
  );

  const openCreate = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const openEdit = (agent: AdminAgent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const submit = () => {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      systemPrompt: form.systemPrompt.trim(),
      modelId: form.modelId === 'auto' ? null : form.modelId,
      enabledTools: form.enabledTools,
      starterPrompts: parseStarterPrompts(form.starterPromptsText),
      imageUrl: form.imageUrl.trim() || null,
      cloneBehavior: form.cloneBehavior,
      updatePolicy: form.updatePolicy,
      lockedFields: form.lockedFields,
      changelog: form.changelog.trim() || null,
    };

    saveMutation.mutate({ id: editingAgent?.id, body });
  };

  const isValid = form.name.trim().length > 0 && form.systemPrompt.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage official starter agents, publish them to the essentials catalog, and control how users can copy them.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <PlusIcon className="size-4" />
          New template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total templates</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{sortedAgents.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {sortedAgents.filter((agent) => agent.catalogStatus === 'published').length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {sortedAgents.filter((agent) => agent.catalogStatus === 'draft').length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">Loading agent templates...</CardContent>
          </Card>
        ) : sortedAgents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              No admin-managed agents yet.
            </CardContent>
          </Card>
        ) : (
          sortedAgents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <StatusBadge status={agent.catalogStatus} />
                    <Badge variant="outline">v{agent.version}</Badge>
                    <Badge variant="outline">{agent.cloneBehavior === 'locked' ? 'Locked' : 'Editable copy'}</Badge>
                  </div>
                  {agent.description ? (
                    <p className="text-sm text-muted-foreground">{agent.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(agent)}>
                    <PencilIcon className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => publishMutation.mutate(agent)}
                    disabled={publishMutation.isPending}
                  >
                    <RocketIcon className="size-3.5" />
                    {agent.catalogStatus === 'published' ? 'Republish' : 'Publish'}
                  </Button>
                  {agent.catalogStatus !== 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => archiveMutation.mutate(agent.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setDeleteConfirmId(agent.id)}
                  >
                    <Trash2Icon className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-medium text-foreground">Model</p>
                  <p>{agent.modelId ?? 'Auto'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Tools</p>
                  <p>{agent.enabledTools.length ? agent.enabledTools.join(', ') : 'None'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Published</p>
                  <p>{formatDate(agent.publishedAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Updated</p>
                  <p>{formatDate(agent.updatedAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingAgent(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Edit admin agent' : 'Create admin agent'}</DialogTitle>
            <DialogDescription>
              Configure the official agent template users will see in Essentials.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Teacher Assistant"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-model">Model</Label>
                <Select
                  value={form.modelId}
                  onValueChange={(value) => setForm((current) => ({ ...current, modelId: value }))}
                >
                  <SelectTrigger id="agent-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-description">Description</Label>
              <Input
                id="agent-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Ready-to-use assistant for..."
              />
            </div>

            <ImageUploadZone
              label="Cover image"
              value={form.imageUrl}
              onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
              onUpload={uploadAdminAgentCover}
              hint="Optional. Shown on the admin agent card."
            />

            <div className="space-y-1.5">
              <Label htmlFor="agent-prompt">System prompt</Label>
              <Textarea
                id="agent-prompt"
                value={form.systemPrompt}
                onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                className="min-h-40"
                placeholder="Core instructions for the official agent..."
              />
            </div>

            <div className="space-y-2">
              <Label>Enabled tools</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {agentToolManifests.map((tool) => {
                  const checked = form.enabledTools.includes(tool.id);
                  return (
                    <label key={tool.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            enabledTools: checked
                              ? current.enabledTools.filter((toolId) => toolId !== tool.id)
                              : [...current.enabledTools, tool.id],
                          }))
                        }
                      />
                      <div>
                        <p className="font-medium">{tool.title}</p>
                        <p className="text-xs text-muted-foreground">{tool.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-starters">Starter prompts</Label>
              <Textarea
                id="agent-starters"
                value={form.starterPromptsText}
                onChange={(event) => setForm((current) => ({ ...current, starterPromptsText: event.target.value }))}
                className="min-h-28"
                placeholder={'One prompt per line\nExplain this lesson\nCreate a quiz from this topic'}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Clone behavior</Label>
                <Select
                  value={form.cloneBehavior}
                  onValueChange={(value: AgentFormState['cloneBehavior']) =>
                    setForm((current) => ({ ...current, cloneBehavior: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editable_copy">Editable copy</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Update policy</Label>
                <Select
                  value={form.updatePolicy}
                  onValueChange={(value: AgentFormState['updatePolicy']) =>
                    setForm((current) => ({ ...current, updatePolicy: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Notify users</SelectItem>
                    <SelectItem value="none">No update prompts</SelectItem>
                    <SelectItem value="auto_for_locked">Auto update locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Locked fields</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {AGENT_LOCK_FIELDS.map((field) => {
                  const checked = form.lockedFields.includes(field);
                  return (
                    <label key={field} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            lockedFields: checked
                              ? current.lockedFields.filter((value) => value !== field)
                              : [...current.lockedFields, field],
                          }))
                        }
                      />
                      {field}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-changelog">Changelog</Label>
              <Textarea
                id="agent-changelog"
                value={form.changelog}
                onChange={(event) => setForm((current) => ({ ...current, changelog: event.target.value }))}
                className="min-h-24"
                placeholder="What changed in this version?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!isValid || saveMutation.isPending} className="gap-1.5">
              <BotIcon className="size-4" />
              {saveMutation.isPending ? 'Saving...' : editingAgent ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete agent template?</DialogTitle>
            <DialogDescription>
              This permanently removes the template from the database. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
            >
              <Trash2Icon className="size-4" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
