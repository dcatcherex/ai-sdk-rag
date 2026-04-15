'use client';

import { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { CountTabsList } from '@/components/ui/count-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { setNewChatIntent } from '@/features/chat/hooks/use-threads';
import { setPendingChatIntent } from '@/features/chat/lib/pending-chat-intent';
import { AgentCard } from './agent-card';
import { AgentEditorPanel } from './agent-editor-panel';
import { PublicShareDialog } from './public-share-dialog';
import {
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
  useUseTemplate,
} from '../hooks/use-agents';
import { useChatVisibleAgents } from '../hooks/use-chat-visible-agents';
import type { Agent, AgentWithSharing, CreateAgentInput } from '../types';

const EssentialAgentCard = ({
  agent,
  isActive,
  onToggleActive,
  onCustomize,
  isPending,
}: {
  agent: Agent;
  isActive: boolean;
  onToggleActive: () => void;
  onCustomize: (id: string) => void;
  isPending: boolean;
}) => (
  <AgentCard
    name={agent.name}
    imageUrl={agent.imageUrl}
    isActive={isActive}
    onToggleActive={onToggleActive}
    onHoverAction={() => onCustomize(agent.id)}
    hoverActionTitle={isPending ? 'Copying...' : agent.cloneBehavior === 'locked' ? 'Use now' : 'Customize'}
    className={isPending ? 'pointer-events-none opacity-70' : undefined}
  />
);

const MyAgentCard = ({
  agent,
  isActive,
  onToggleActive,
  onEdit,
  onDelete,
  onShare,
  onChat,
}: {
  agent: Agent;
  isActive: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onChat: () => void;
}) => (
  <AgentCard
    name={agent.name}
    imageUrl={agent.imageUrl}
    isActive={isActive}
    isPublic={agent.isPublic}
    onToggleActive={onToggleActive}
    onEdit={onEdit}
    onDelete={onDelete}
    onShare={onShare}
    onChat={onChat}
  />
);

const CommunityAgentCard = ({
  agent,
  onChat,
}: {
  agent: AgentWithSharing;
  onChat: () => void;
}) => (
  <AgentCard
    name={agent.name}
    imageUrl={agent.imageUrl}
    onChat={onChat}
  />
);

export const AgentsList = () => {
  const router = useRouter();
  const { data, isLoading } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const useTemplate = useUseTemplate();
  const { isPersonalVisible, isEssentialVisible, togglePersonal, toggleEssential, activatePersonal } = useChatVisibleAgents();

  const agents = data?.agents ?? [];
  const mine = data?.mine ?? [];
  const shared = data?.shared ?? [];
  const essentials = data?.essentials ?? data?.templates ?? [];

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'essentials' | 'mine' | 'community'>('essentials');
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [shareTarget, setShareTarget] = useState<Agent | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const editTarget = editTargetId
    ? agents.find((agent) => agent.id === editTargetId) ?? null
    : null;
  const myAgents = mine;
  const communityAgents = shared as AgentWithSharing[];
  const essentialsById = useMemo(
    () => Object.fromEntries(essentials.map((agent) => [agent.id, agent])),
    [essentials],
  );
  const getTemplateUpdateState = (agent: Agent) => {
    if (!agent.templateId || agent.sourceTemplateVersion === null) return false;
    const source = essentialsById[agent.templateId];
    return Boolean(source && source.version > agent.sourceTemplateVersion);
  };
  const myUpdateCount = myAgents.filter(getTemplateUpdateState).length;

  const handleFormSubmit = (formData: CreateAgentInput) => {
    if (editTarget) {
      updateAgent.mutate(
        { id: editTarget.id, ...formData },
        { onSuccess: () => { setMode('list'); setEditTargetId(null); } },
      );
      return;
    }

    createAgent.mutate(formData, {
      onSuccess: (newAgent) => {
        activatePersonal(newAgent.id);
        setMode('list');
      },
    });
  };

  const openCreate = () => {
    setEditTargetId(null);
    setMode('create');
  };

  const openEdit = (agent: Agent) => {
    setEditTargetId(agent.id);
    setMode('edit');
  };

  const closeEditor = () => {
    setMode('list');
    setEditTargetId(null);
  };

  const startChatWithAgent = (agentId: string | null) => {
    setPendingChatIntent({ agentId });
    setNewChatIntent();
    router.push('/');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAgent.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const handleUseTemplate = (templateId: string) => {
    setPendingTemplateId(templateId);
    useTemplate.mutate(templateId, {
      onSuccess: (newAgent) => {
        setPendingTemplateId(null);
        activatePersonal(newAgent.id);
        toast.success('Agent added to your library');
      },
      onError: () => setPendingTemplateId(null),
    });
  };

  if (mode !== 'list') {
    const editorAgent = mode === 'edit' ? editTarget : null;

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
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Coworkers"
        description="เลือกเพื่อนร่วมงาน AI แบบพร้อมใช้ หรือสร้างผู้ช่วยที่เหมาะกับงานของคุณ"
        action={(
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            Create AI coworker
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agents...</p>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <CountTabsList
              className="mb-5"
              items={[
                { value: 'essentials', label: 'Essentials', count: essentials.length },
                { value: 'mine', label: 'Mine', count: myAgents.length },
                { value: 'community', label: 'Community', count: communityAgents.length },
              ]}
            />

            <TabsContent value="essentials">
              {essentials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No essential agents available yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {essentials.map((agent) => (
                    <EssentialAgentCard
                      key={agent.id}
                      agent={agent}
                      isActive={isEssentialVisible(agent.id)}
                      onToggleActive={() => toggleEssential(agent.id)}
                      onCustomize={handleUseTemplate}
                      isPending={pendingTemplateId === agent.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="mine">
              {myUpdateCount > 0 && (
                <p className="mb-4 text-sm text-muted-foreground">
                  {myUpdateCount} of your agents have newer official template versions available.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {myAgents.map((agent) => (
                  <MyAgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={isPersonalVisible(agent.id)}
                    onToggleActive={() => togglePersonal(agent.id)}
                    onEdit={() => openEdit(agent)}
                    onDelete={() => setDeleteTarget(agent)}
                    onShare={() => setShareTarget(agent)}
                    onChat={() => startChatWithAgent(agent.id)}
                  />
                ))}
              </div>

              {myAgents.length === 0 && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  You have not created any AI coworkers yet. Start from Essentials or create one for your own workflow.
                </p>
              )}
            </TabsContent>

            <TabsContent value="community">
              {communityAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No community AI coworkers yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {communityAgents.map((agent) => (
                    <CommunityAgentCard
                      key={agent.id}
                      agent={agent}
                      onChat={() => startChatWithAgent(agent.id)}
                    />
                  ))}
                </div>
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
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
              {deleteAgent.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
