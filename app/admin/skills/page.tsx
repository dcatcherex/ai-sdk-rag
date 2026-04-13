'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
} from 'lucide-react';

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

type AdminSkill = {
  id: string;
  name: string;
  description: string | null;
  triggerType: 'slash' | 'keyword' | 'always';
  trigger: string | null;
  promptFragment: string;
  enabledTools: string[];
  activationMode: 'rule' | 'model';
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

type SkillsResponse = {
  skills: AdminSkill[];
};

type SkillFormState = {
  name: string;
  description: string;
  activationMode: 'rule' | 'model';
  triggerType: 'slash' | 'keyword' | 'always';
  trigger: string;
  promptFragment: string;
  enabledTools: string[];
  imageUrl: string;
  cloneBehavior: 'locked' | 'editable_copy';
  updatePolicy: 'none' | 'notify' | 'auto_for_locked';
  lockedFields: string[];
  changelog: string;
};

const SKILL_LOCK_FIELDS = [
  'promptFragment',
  'triggerType',
  'trigger',
  'activationMode',
  'enabledTools',
  'files',
] as const;

const toolManifests = getAgentManifests();

const emptyForm = (): SkillFormState => ({
  name: '',
  description: '',
  activationMode: 'rule',
  triggerType: 'always',
  trigger: '',
  promptFragment: '',
  enabledTools: [],
  imageUrl: '',
  cloneBehavior: 'editable_copy',
  updatePolicy: 'notify',
  lockedFields: [],
  changelog: '',
});

const toFormState = (skill: AdminSkill | null): SkillFormState => {
  if (!skill) return emptyForm();
  return {
    name: skill.name,
    description: skill.description ?? '',
    activationMode: skill.activationMode,
    triggerType: skill.triggerType,
    trigger: skill.trigger ?? '',
    promptFragment: skill.promptFragment,
    enabledTools: skill.enabledTools,
    imageUrl: skill.imageUrl ?? '',
    cloneBehavior: skill.cloneBehavior,
    updatePolicy: skill.updatePolicy,
    lockedFields: skill.lockedFields,
    changelog: skill.changelog ?? '',
  };
};

async function uploadAdminSkillCover(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/skills/image', { method: 'POST', body: formData });
  const json = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Upload failed');
  return json.url ?? '';
}

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

function StatusBadge({ status }: { status: AdminSkill['catalogStatus'] }) {
  if (status === 'published') return <Badge variant="secondary">Published</Badge>;
  if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default function AdminSkillsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AdminSkill | null>(null);
  const [form, setForm] = useState<SkillFormState>(emptyForm);

  const { data, isLoading } = useQuery<SkillsResponse>({
    queryKey: ['admin', 'skills'],
    queryFn: async () => {
      const res = await fetch('/api/admin/skills');
      if (!res.ok) throw new Error('Failed to load admin skills');
      return res.json();
    },
  });

  useEffect(() => {
    setForm(toFormState(editingSkill));
  }, [editingSkill]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; body: Record<string, unknown> }) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch(isEdit ? `/api/admin/skills/${payload.id}` : '/api/admin/skills', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ skill: AdminSkill }>;
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingSkill(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (skill: AdminSkill) => {
      const res = await fetch(`/api/admin/skills/${skill.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changelog: skill.changelog }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/skills/${id}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] });
    },
  });

  const sortedSkills = useMemo(
    () => [...(data?.skills ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data?.skills],
  );

  const openCreate = () => {
    setEditingSkill(null);
    setDialogOpen(true);
  };

  const openEdit = (skill: AdminSkill) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  };

  const submit = () => {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      activationMode: form.activationMode,
      triggerType: form.triggerType,
      trigger:
        form.activationMode === 'rule' && form.triggerType !== 'always'
          ? form.trigger.trim() || null
          : null,
      promptFragment: form.promptFragment.trim(),
      enabledTools: form.enabledTools,
      imageUrl: form.imageUrl.trim() || null,
      cloneBehavior: form.cloneBehavior,
      updatePolicy: form.updatePolicy,
      lockedFields: form.lockedFields,
      changelog: form.changelog.trim() || null,
    };

    saveMutation.mutate({ id: editingSkill?.id, body });
  };

  const isValid =
    form.name.trim().length > 0 &&
    form.promptFragment.trim().length > 0 &&
    (form.activationMode === 'model' || form.triggerType === 'always' || form.trigger.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Skills</h1>
          <p className="text-sm text-muted-foreground">
            Manage official starter skills, publish them to the essentials catalog, and define how strictly they stay managed.
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
          <CardContent className="text-2xl font-bold">{sortedSkills.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {sortedSkills.filter((skill) => skill.catalogStatus === 'published').length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {sortedSkills.filter((skill) => skill.catalogStatus === 'draft').length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">Loading skill templates...</CardContent>
          </Card>
        ) : sortedSkills.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              No admin-managed skills yet.
            </CardContent>
          </Card>
        ) : (
          sortedSkills.map((skill) => (
            <Card key={skill.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{skill.name}</CardTitle>
                    <StatusBadge status={skill.catalogStatus} />
                    <Badge variant="outline">v{skill.version}</Badge>
                    <Badge variant="outline">{skill.cloneBehavior === 'locked' ? 'Locked' : 'Editable copy'}</Badge>
                    <Badge variant="outline">{skill.activationMode}</Badge>
                  </div>
                  {skill.description ? (
                    <p className="text-sm text-muted-foreground">{skill.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(skill)}>
                    <PencilIcon className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => publishMutation.mutate(skill)}
                    disabled={publishMutation.isPending}
                  >
                    <RocketIcon className="size-3.5" />
                    {skill.catalogStatus === 'published' ? 'Republish' : 'Publish'}
                  </Button>
                  {skill.catalogStatus !== 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => archiveMutation.mutate(skill.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="font-medium text-foreground">Trigger</p>
                  <p>{skill.triggerType}{skill.trigger ? `: ${skill.trigger}` : ''}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Tools</p>
                  <p>{skill.enabledTools.length ? skill.enabledTools.join(', ') : 'None'}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Published</p>
                  <p>{formatDate(skill.publishedAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Updated</p>
                  <p>{formatDate(skill.updatedAt)}</p>
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
          if (!open) setEditingSkill(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? 'Edit admin skill' : 'Create admin skill'}</DialogTitle>
            <DialogDescription>
              Configure the official skill template users will see in Essential skills.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="brand-guidelines"
              />
            </div>

            <ImageUploadZone
              label="Cover image"
              value={form.imageUrl}
              onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
              onUpload={uploadAdminSkillCover}
              hint="Optional. Shown on the admin skill card."
            />

            <div className="space-y-1.5">
              <Label htmlFor="skill-description">Description</Label>
              <Input
                id="skill-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What this skill does and when to activate it"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Activation mode</Label>
                <Select
                  value={form.activationMode}
                  onValueChange={(value: SkillFormState['activationMode']) =>
                    setForm((current) => ({ ...current, activationMode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule">Rule</SelectItem>
                    <SelectItem value="model">Model</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trigger type</Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(value: SkillFormState['triggerType']) =>
                    setForm((current) => ({ ...current, triggerType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="slash">Slash</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skill-trigger">Trigger</Label>
                <Input
                  id="skill-trigger"
                  value={form.trigger}
                  onChange={(event) => setForm((current) => ({ ...current, trigger: event.target.value }))}
                  placeholder={form.triggerType === 'slash' ? '/teach' : 'farming'}
                  disabled={form.activationMode === 'model' || form.triggerType === 'always'}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-prompt">Prompt instructions</Label>
              <Textarea
                id="skill-prompt"
                value={form.promptFragment}
                onChange={(event) => setForm((current) => ({ ...current, promptFragment: event.target.value }))}
                className="min-h-48"
                placeholder="Detailed instructions for how this official skill should behave..."
              />
            </div>

            <div className="space-y-2">
              <Label>Enabled tools</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {toolManifests.map((tool) => {
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Clone behavior</Label>
                <Select
                  value={form.cloneBehavior}
                  onValueChange={(value: SkillFormState['cloneBehavior']) =>
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
                  onValueChange={(value: SkillFormState['updatePolicy']) =>
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
                {SKILL_LOCK_FIELDS.map((field) => {
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
              <Label htmlFor="skill-changelog">Changelog</Label>
              <Textarea
                id="skill-changelog"
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
              <SparklesIcon className="size-4" />
              {saveMutation.isPending ? 'Saving...' : editingSkill ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
