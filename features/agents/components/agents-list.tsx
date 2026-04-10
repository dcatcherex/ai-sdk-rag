'use client';

import { useState } from 'react';
import { CopyIcon, PlusIcon } from 'lucide-react';
import { AgentCard } from './agent-card';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authClient } from '@/lib/auth-client';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useUseTemplate } from '../hooks/use-agents';
import { usePublicShare, useUpdatePublicShare } from '../hooks/use-public-share';
import { AgentEditorPanel } from './agent-editor-panel';
import { PublicShareDialog } from './public-share-dialog';
import type { Agent, AgentWithSharing, CreateAgentInput } from '../types';


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
  <AgentCard
    name={template.name}
    description={template.description}
    footer={
      <Button
        size="sm"
        variant="outline"
        className="w-full gap-1.5 text-xs"
        onClick={() => onUse(template.id)}
        disabled={isPending}
      >
        <CopyIcon className="size-3.5" />
        {isPending ? 'Copying…' : 'Use template'}
      </Button>
    }
  />
);

// ── MyAgentCard — wraps AgentCard with share-link active toggle ───────────────

const MyAgentCard = ({
  agent,
  onEdit,
  onDelete,
  onShare,
}: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
}) => {
  const { data: share } = usePublicShare(agent.id);
  const updateShare = useUpdatePublicShare(agent.id);
  return (
    <AgentCard
      name={agent.name}
      description={agent.description}
      imageUrl={agent.imageUrl}
      isActive={share?.isActive ?? false}
      isPublic={agent.isPublic}
      onToggleActive={share ? () => updateShare.mutate({ isActive: !share.isActive }) : undefined}
      onEdit={onEdit}
      onDelete={onDelete}
      onShare={onShare}
    />
  );
};

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
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {/* General Agent — always pinned first */}
                <AgentCard
                  name="General"
                  description={generalAgent?.description ?? 'Your default assistant. Configure its tools, model, and instructions.'}
                  imageUrl={generalAgent?.imageUrl}
                  isActive
                  onEdit={() => openConfigureGeneral(generalAgent ?? null)}
                />

                {/* User's custom agents */}
                {myAgents.map((a) => (
                  <MyAgentCard
                    key={a.id}
                    agent={a}
                    onEdit={() => openEdit(a)}
                    onDelete={() => setDeleteTarget(a)}
                    onShare={() => setShareTarget(a)}
                  />
                ))}

                {/* Shared agents (from others) */}
                {sharedAgents.map((a) => {
                  const withSharing = a as AgentWithSharing;
                  return (
                    <AgentCard
                      key={a.id}
                      name={a.name}
                      description={withSharing.ownerName ? `${a.description ?? ''}\nBy ${withSharing.ownerName}`.trim() : a.description}
                      imageUrl={a.imageUrl}
                    />
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
