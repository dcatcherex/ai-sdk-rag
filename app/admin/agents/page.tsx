'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  Settings2Icon,
  Trash2Icon,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentForm } from '@/features/agents/components/agent-form';
import { AdminAgentCatalogSection } from '@/features/agents/components/admin-agent-catalog-section';
import type { Skill } from '@/features/skills/types';
import type { Agent, CreateAgentInput } from '@/features/agents/types';

type AgentsResponse = {
  agents: Agent[];
};

type AdminSkillsResponse = {
  skills: Skill[];
};

type CatalogFormState = {
  changelog: string;
  cloneBehavior: 'locked' | 'editable_copy';
  lockedFields: string[];
  updatePolicy: 'none' | 'notify' | 'auto_for_locked';
};

const ADMIN_VISIBLE_SECTIONS = ['general', 'behavior', 'skills', 'tools', 'mcp'] as const;
const ADMIN_CATALOG_SECTION_ID = 'catalog';

function formatDate(date: string | Date | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

function StatusBadge({ status }: { status: Agent['catalogStatus'] }) {
  if (status === 'published') return <Badge variant="secondary">Published</Badge>;
  if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function AdminAgentEditor({
  agent,
  availableSkills,
  isPending = false,
  onBack,
  onSubmit,
}: {
  agent: Agent | null;
  availableSkills: Skill[];
  isPending?: boolean;
  onBack: () => void;
  onSubmit: (input: CreateAgentInput & CatalogFormState) => void;
}) {
  const isEdit = Boolean(agent);
  const [activeSection, setActiveSection] = useState<string>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>({
    changelog: '',
    cloneBehavior: 'editable_copy',
    lockedFields: [],
    updatePolicy: 'notify',
  });

  useEffect(() => {
    setCatalogForm({
      changelog: agent?.changelog ?? '',
      cloneBehavior: agent?.cloneBehavior ?? 'editable_copy',
      lockedFields: agent?.lockedFields ?? [],
      updatePolicy: agent?.updatePolicy ?? 'notify',
    });
  }, [agent]);

  useEffect(() => {
    setActiveSection('general');
    setHasUnsavedChanges(false);
    setShowLeaveDialog(false);
  }, [agent]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (isPending) {
      return;
    }

    if (hasUnsavedChanges) {
      setShowLeaveDialog(true);
      return;
    }

    onBack();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={isEdit ? 'Edit Admin Agent' : 'Create Admin Agent'}
        description="Reuse the shared agent editor for official templates, then set catalog behavior for publishing and copy rules."
        leading={(
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleBack} disabled={isPending}>
            <ArrowLeftIcon className="size-4" />
            Back to Admin Agents
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-hidden px-6 py-6">
        <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col">
          <AgentForm
            key={`${agent?.id ?? 'new'}:${agent?.updatedAt ?? 'draft'}`}
            activeSection={activeSection}
            agent={agent}
            availableSkills={availableSkills}
            customSections={[
              {
                id: ADMIN_CATALOG_SECTION_ID,
                icon: Settings2Icon,
                label: 'Catalog',
                description: 'Set copy behavior, update rules, and changelog metadata for this official template.',
                content: (
                  <AdminAgentCatalogSection
                    changelog={catalogForm.changelog}
                    cloneBehavior={catalogForm.cloneBehavior}
                    lockedFields={catalogForm.lockedFields}
                    onChangelogChange={(value) => setCatalogForm((current) => ({ ...current, changelog: value }))}
                    onCloneBehaviorChange={(value) => setCatalogForm((current) => ({ ...current, cloneBehavior: value }))}
                    onLockedFieldToggle={(field) =>
                      setCatalogForm((current) => ({
                        ...current,
                        lockedFields: current.lockedFields.includes(field)
                          ? current.lockedFields.filter((lockedField) => lockedField !== field)
                          : [...current.lockedFields, field],
                      }))
                    }
                    onUpdatePolicyChange={(value) => setCatalogForm((current) => ({ ...current, updatePolicy: value }))}
                    updatePolicy={catalogForm.updatePolicy}
                  />
                ),
              },
            ]}
            enableBrandSelection
            isPending={isPending}
            layout="panel"
            onCancel={handleBack}
            onDirtyChange={setHasUnsavedChanges}
            onSectionChange={setActiveSection}
            onSubmit={(input) => onSubmit({ ...input, ...catalogForm })}
            showStructuredStarterTasksEditor
            skillAttachmentsRoutePrefix="/api/admin/agents"
            submitLabel={isEdit ? 'Save template' : 'Create template'}
            visibleSections={[...ADMIN_VISIBLE_SECTIONS]}
          />
        </div>
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits in this admin template. Leave the editor now and those changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onBack}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminAgentsPage() {
  const queryClient = useQueryClient();
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AgentsResponse>({
    queryKey: ['admin', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to load admin agents');
      return res.json();
    },
  });

  const { data: adminSkillsData } = useQuery<AdminSkillsResponse>({
    queryKey: ['admin', 'skills'],
    queryFn: async () => {
      const res = await fetch('/api/admin/skills');
      if (!res.ok) throw new Error('Failed to load admin skills');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; input: CreateAgentInput & CatalogFormState }) => {
      const isEdit = Boolean(payload.id);
      const body = {
        name: payload.input.name.trim(),
        description: payload.input.description?.trim() || null,
        systemPrompt: payload.input.systemPrompt.trim(),
        modelId: payload.input.modelId ?? null,
        enabledTools: payload.input.enabledTools ?? [],
        skillAttachments: payload.input.skillAttachments ?? [],
        starterTasks: payload.input.starterTasks ?? [],
        brandId: payload.input.brandId ?? null,
        brandMode: payload.input.brandMode ?? 'optional',
        brandAccessPolicy: payload.input.brandAccessPolicy ?? 'any_accessible',
        requiresBrandForRun: payload.input.requiresBrandForRun ?? false,
        fallbackBehavior: payload.input.fallbackBehavior ?? 'ask_or_continue',
        imageUrl: payload.input.imageUrl ?? null,
        cloneBehavior: payload.input.cloneBehavior,
        updatePolicy: payload.input.updatePolicy,
        lockedFields: payload.input.lockedFields,
        changelog: payload.input.changelog.trim() || null,
        mcpServers: payload.input.mcpServers ?? [],
      };

      const res = await fetch(isEdit ? `/api/admin/agents/${payload.id}` : '/api/admin/agents', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ agent: Agent }>;
    },
    onSuccess: () => {
      setEditingAgent(null);
      setIsCreating(false);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (agent: Agent) => {
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
    () => [...(data?.agents ?? [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    [data?.agents],
  );

  if (editingAgent || isCreating) {
    return (
      <AdminAgentEditor
        agent={editingAgent}
        availableSkills={adminSkillsData?.skills ?? []}
        isPending={saveMutation.isPending}
        onBack={() => {
          setEditingAgent(null);
          setIsCreating(false);
        }}
        onSubmit={(input) => {
          saveMutation.mutate({ id: editingAgent?.id, input });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage official starter agents, publish them to Essentials, and keep the editor aligned with the main user flow.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreating(true)}>
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
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingAgent(agent)}>
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

      <AlertDialog open={Boolean(deleteConfirmId)} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the admin template from the catalog. Existing user copies are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate(deleteConfirmId);
                }
              }}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
