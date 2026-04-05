'use client';

import { useState } from 'react';
import { BotIcon, CopyIcon, GlobeIcon, PencilIcon, PlusIcon, Settings2Icon, Share2Icon, SparklesIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { availableModels } from '@/lib/ai';
import { TOOL_REGISTRY } from '@/lib/tool-registry';
import { authClient } from '@/lib/auth-client';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useUseTemplate } from '../hooks/use-agents';
import { AgentEditorPanel } from './agent-editor-panel';
import { PublicShareDialog } from './public-share-dialog';
import type { Agent, AgentWithSharing, CreateAgentInput } from '../types';

// ── General Agent placeholder card ───────────────────────────────────────────

const GeneralAgentCard = ({
  generalAgent,
  onConfigure,
}: {
  generalAgent: Agent | undefined;
  onConfigure: (agent: Agent | null) => void;
}) => (
  <div className="relative flex flex-col gap-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
    <div className="flex items-start gap-2">
      <SparklesIcon className="size-4 shrink-0 text-primary mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium text-sm">General</p>
          <Badge className="text-[10px] h-4 px-1.5">Default</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {generalAgent?.description ?? 'Your default assistant. Configure its tools, model, and instructions.'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => onConfigure(generalAgent ?? null)}
        title="Configure general agent"
      >
        <Settings2Icon className="size-3.5" />
      </Button>
    </div>
    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
      <Badge variant="secondary" className="text-[11px]">
        {generalAgent?.modelId
          ? (availableModels.find((m) => m.id === generalAgent.modelId)?.name ?? generalAgent.modelId)
          : 'Auto'}
      </Badge>
      {(generalAgent?.enabledTools ?? []).map((toolId) => {
        const meta = TOOL_REGISTRY[toolId as keyof typeof TOOL_REGISTRY];
        return meta ? (
          <Badge key={toolId} variant="outline" className="text-[11px]">
            {meta.label}
          </Badge>
        ) : null;
      })}
      {!generalAgent && (
        <span className="text-[11px] text-muted-foreground italic">Not configured — using smart defaults</span>
      )}
    </div>
  </div>
);

// ── Template card ─────────────────────────────────────────────────────────────

const TemplateCard = ({
  template,
  onUse,
  isPending,
}: {
  template: Agent;
  onUse: (id: string) => void;
  isPending: boolean;
}) => (
  <div className="flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/20 p-4">
    <div className="flex items-start gap-2">
      <BotIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{template.name}</p>
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
        )}
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5 mt-1">
      {template.starterPrompts.slice(0, 2).map((p, i) => (
        <span key={i} className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 line-clamp-1 max-w-[180px]">
          &ldquo;{p}&rdquo;
        </span>
      ))}
    </div>
    <Button
      size="sm"
      variant="outline"
      className="mt-auto gap-1.5 text-xs"
      onClick={() => onUse(template.id)}
      disabled={isPending}
    >
      <CopyIcon className="size-3.5" />
      {isPending ? 'Copying…' : 'Use template'}
    </Button>
  </div>
);

// ── AgentsList ────────────────────────────────────────────────────────────────

export const AgentsList = () => {
  const { data, isLoading } = useAgents();
  const agents = data?.agents ?? [];
  const templates = data?.templates ?? [];

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const useTemplate = useUseTemplate();

  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id;

  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'configure-general'>('list');
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [shareTarget, setShareTarget] = useState<Agent | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const generalAgent = agents.find((a) => a.isDefault && a.userId === currentUserId);
  const myAgents = agents.filter((a) => a.userId === currentUserId && !a.isDefault);
  const sharedAgents = agents.filter((a) => a.userId !== currentUserId);

  const handleFormSubmit = (data: CreateAgentInput) => {
    if (mode === 'configure-general') {
      if (generalAgent) {
        updateAgent.mutate(
          { id: generalAgent.id, ...data },
          { onSuccess: () => setMode('list') },
        );
      } else {
        createAgent.mutate(
          { ...data, isDefault: true } as CreateAgentInput & { isDefault: boolean },
          { onSuccess: () => setMode('list') },
        );
      }
      return;
    }
    if (editTarget) {
      updateAgent.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setMode('list'); setEditTarget(null); } },
      );
    } else {
      createAgent.mutate(data, { onSuccess: () => setMode('list') });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (a: Agent) => {
    setEditTarget(a);
    setMode('edit');
  };

  const openConfigureGeneral = (a: Agent | null) => {
    setEditTarget(a);
    setMode('configure-general');
  };

  const closeEditor = () => {
    setMode('list');
    setEditTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAgent.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const handleUseTemplate = (templateId: string) => {
    setPendingTemplateId(templateId);
    useTemplate.mutate(templateId, {
      onSuccess: () => {
        setPendingTemplateId(null);
        toast.success('Agent created from template');
      },
      onError: () => setPendingTemplateId(null),
    });
  };

  const modelName = (modelId: string | null) =>
    modelId ? (availableModels.find((m) => m.id === modelId)?.name ?? modelId) : 'Auto';

  if (mode !== 'list') {
    const editorAgent = mode === 'configure-general'
      ? (generalAgent ?? null)
      : (mode === 'edit' ? editTarget : null);

    return (
      <AgentEditorPanel
        agent={editorAgent}
        onBack={closeEditor}
        onSubmit={handleFormSubmit}
        isPending={createAgent.isPending || updateAgent.isPending}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Agents"
        description="Custom AI agents with tailored system prompts and tools"
        action={
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            New agent
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agents…</p>
        ) : (
          <Tabs defaultValue="my-agents">
            <TabsList className="mb-5">
              <TabsTrigger value="my-agents">My Agents</TabsTrigger>
              <TabsTrigger value="templates">
                Templates
                {templates.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5">
                    {templates.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── My Agents tab ── */}
            <TabsContent value="my-agents">
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {/* General Agent — always pinned first */}
                <GeneralAgentCard
                  generalAgent={generalAgent}
                  onConfigure={openConfigureGeneral}
                />

                {/* User's custom agents */}
                {myAgents.map((a) => {
                  const withSharing = a as AgentWithSharing;
                  return (
                    <div
                      key={a.id}
                      className="group relative flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 transition hover:bg-muted/50"
                    >
                      {/* Action buttons — absolutely positioned top-right, visible on hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
                        <ButtonGroup className='border rounded-full bg-background'>
                          <Button variant="ghost" size="icon" className="size-7 hover:cursor-pointer rounded-full" onClick={() => setShareTarget(a)} title="Share">
                            <Share2Icon className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 hover:cursor-pointer rounded-full" onClick={() => openEdit(a)} title="Edit">
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive hover:cursor-pointer rounded-full"
                            onClick={() => setDeleteTarget(a)}
                            title="Delete"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </ButtonGroup>
                      </div>

                      {/* Header: icon + full-width title */}
                      <div className="flex items-start gap-2">
                        <div className="">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm line-clamp-1">{a.name}</p>
                            
                            {a.isPublic && (
                              <span title="Public">
                                <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                              </span>
                            )}
                          </div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>
                          )}
                        </div>
                      </div>

                      {(withSharing.sharedWith?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <UsersIcon className="size-3 shrink-0" />
                          <span className="truncate">{withSharing.sharedWith!.map((u) => u.name).join(', ')}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        <Badge variant="secondary" className="text-[11px]">{modelName(a.modelId)}</Badge>
                        {(a.documentIds?.length ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[11px]">
                            {a.documentIds.length} doc{a.documentIds.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {a.enabledTools.map((toolId) => {
                          const meta = TOOL_REGISTRY[toolId as keyof typeof TOOL_REGISTRY];
                          return meta ? (
                            <Badge key={toolId} variant="outline" className="text-[11px]">{meta.label}</Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Shared agents (from others) */}
                {sharedAgents.map((a) => {
                  const withSharing = a as AgentWithSharing;
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/20 p-4"
                    >
                      <div className="flex items-start gap-2">
                        <BotIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{a.name}</p>
                          {a.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.description}</p>
                          )}
                          {withSharing.ownerName && (
                            <p className="text-xs text-muted-foreground mt-0.5">By {withSharing.ownerName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        <Badge variant="secondary" className="text-[11px]">{modelName(a.modelId)}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {myAgents.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground text-center">
                  No custom agents yet. Create one or use a template.
                </p>
              )}
            </TabsContent>

            {/* ── Templates tab ── */}
            <TabsContent value="templates">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates available.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ready-to-use agents. Click &ldquo;Use template&rdquo; to create your own editable copy.
                  </p>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                    {templates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onUse={handleUseTemplate}
                        isPending={pendingTemplateId === t.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {shareTarget && (
        <PublicShareDialog
          agentId={shareTarget.id}
          agentName={shareTarget.name}
          open={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
        />
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteAgent.isPending}>
              {deleteAgent.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
