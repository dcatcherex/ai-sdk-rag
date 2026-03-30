'use client';

import { useState } from 'react';
import { BotIcon, GlobeIcon, PencilIcon, PlusIcon, Share2Icon, Trash2Icon, UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/use-agents';
import { AgentEditorPanel } from './agent-editor-panel';
import { PublicShareDialog } from './public-share-dialog';
import type { Agent, AgentWithSharing, CreateAgentInput } from '../types';

export const AgentsList = () => {
  const { data: agents = [], isLoading } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id;

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [shareTarget, setShareTarget] = useState<Agent | null>(null);

  const handleFormSubmit = (data: CreateAgentInput) => {
    if (editTarget) {
      updateAgent.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setMode('list'); setEditTarget(null); } },
      );
    } else {
      createAgent.mutate(data, {
        onSuccess: () => setMode('list'),
      });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (agent: Agent) => {
    setEditTarget(agent);
    setMode('edit');
  };

  const closeEditor = () => {
    setMode('list');
    setEditTarget(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAgent.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const modelName = (modelId: string | null) => {
    if (!modelId) return 'Auto';
    return availableModels.find((m) => m.id === modelId)?.name ?? modelId;
  };

  return (
    <div className="flex flex-col h-full">
      {mode === 'list' ? (
        <>
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
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <BotIcon className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium">No agents yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create an agent to give the chat a custom system prompt, preferred model, and selected tools.
                </p>
                <Button onClick={openCreate} size="sm" className="gap-1.5 mt-1">
                  <PlusIcon className="size-4" />
                  Create your first agent
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {agents.map((agent) => {
                  const isOwner = agent.userId === currentUserId;
                  const withSharing = agent as AgentWithSharing;
                  return (
                    <div
                      key={agent.id}
                      className="group relative flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 transition hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BotIcon className="size-4 shrink-0 text-primary" />
                          <span className="font-medium truncate">{agent.name}</span>
                        </div>
                        {isOwner && (
                          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => setShareTarget(agent)}
                              title="Share agent"
                            >
                              <Share2Icon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEdit(agent)}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(agent)}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {agent.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {agent.description}
                        </p>
                      )}

                      {!isOwner && withSharing.ownerName && (
                        <p className="text-xs text-muted-foreground">
                          By {withSharing.ownerName}
                        </p>
                      )}

                      {isOwner && (withSharing.sharedWith?.length ?? 0) > 0 && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <UsersIcon className="size-3 shrink-0 mt-0.5" />
                          <span className="leading-snug">
                            {withSharing.sharedWith!.map((u) => u.name).join(', ')}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                        <Badge variant="secondary" className="text-[11px]">
                          {modelName(agent.modelId)}
                        </Badge>
                        {(agent.documentIds?.length ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[11px]">
                            {agent.documentIds.length} doc{agent.documentIds.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {isOwner && agent.isPublic && (
                          <Badge variant="secondary" className="text-[11px] gap-1">
                            <GlobeIcon className="size-2.5" /> Public
                          </Badge>
                        )}
                        {agent.enabledTools.map((toolId) => {
                          const meta = TOOL_REGISTRY[toolId as keyof typeof TOOL_REGISTRY];
                          return meta ? (
                            <Badge key={toolId} variant="outline" className="text-[11px]">
                              {meta.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <AgentEditorPanel
          agent={mode === 'edit' ? editTarget : null}
          onBack={closeEditor}
          onSubmit={handleFormSubmit}
          isPending={createAgent.isPending || updateAgent.isPending}
        />
      )}

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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
