'use client';

import { useMemo, useState } from 'react';
import { CopyIcon, GlobeIcon, PlusIcon, RotateCwIcon, ShieldIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const AgentMetaBadges = ({
  agent,
  ownerName,
  updateAvailable = false,
}: {
  agent: Agent;
  ownerName?: string;
  updateAvailable?: boolean;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {agent.managedByAdmin && (
      <Badge variant="secondary" className="gap-1 text-[11px]">
        <ShieldIcon className="size-2.5" />
        Official
      </Badge>
    )}
    {agent.catalogStatus === 'published' && agent.managedByAdmin && (
      <Badge variant="outline" className="text-[11px]">Published</Badge>
    )}
    {agent.cloneBehavior === 'locked' && (
      <Badge variant="outline" className="text-[11px]">Locked</Badge>
    )}
    {agent.templateId && agent.sourceTemplateVersion !== null && (
      <Badge variant="outline" className="text-[11px]">Based on v{agent.sourceTemplateVersion}</Badge>
    )}
    {updateAvailable && (
      <Badge variant="secondary" className="gap-1 text-[11px]">
        <RotateCwIcon className="size-2.5" />
        Update available
      </Badge>
    )}
    {agent.isPublic && (
      <Badge variant="outline" className="gap-1 text-[11px]">
        <GlobeIcon className="size-2.5" />
        Public
      </Badge>
    )}
    {ownerName ? (
      <Badge variant="outline" className="text-[11px]">By {ownerName}</Badge>
    ) : null}
  </div>
);

const EssentialAgentCard = ({
  agent,
  onUse,
  isPending,
}: {
  agent: Agent;
  onUse: (id: string) => void;
  isPending: boolean;
}) => (
  <AgentCard
    name={agent.name}
    description={agent.description}
    imageUrl={agent.imageUrl}
    footer={(
      <div className="flex flex-col gap-2">
        <AgentMetaBadges agent={agent} />
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-xs"
          onClick={() => onUse(agent.id)}
          disabled={isPending}
        >
          <CopyIcon className="size-3.5" />
          {isPending ? 'Copying...' : agent.cloneBehavior === 'locked' ? 'Use now' : 'Customize'}
        </Button>
      </div>
    )}
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
  updateAvailable,
}: {
  agent: Agent;
  isActive: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onChat: () => void;
  updateAvailable: boolean;
}) => (
  <AgentCard
    name={agent.name}
    description={agent.description}
    imageUrl={agent.imageUrl}
    isActive={isActive}
    isPublic={agent.isPublic}
    onToggleActive={onToggleActive}
    onEdit={onEdit}
    onDelete={onDelete}
    onShare={onShare}
    onChat={onChat}
    footer={<AgentMetaBadges agent={agent} updateAvailable={updateAvailable} />}
  />
);

const SharedAgentCard = ({
  agent,
  onChat,
}: {
  agent: AgentWithSharing;
  onChat: () => void;
}) => (
  <AgentCard
    name={agent.name}
    description={agent.description}
    imageUrl={agent.imageUrl}
    onChat={onChat}
    footer={<AgentMetaBadges agent={agent} ownerName={agent.ownerName} />}
  />
);

export const AgentsList = () => {
  const router = useRouter();
  const { data, isLoading } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const useTemplate = useUseTemplate();
  const { isVisible, toggle: toggleChatVisible } = useChatVisibleAgents();

  const agents = data?.agents ?? [];
  const mine = data?.mine ?? [];
  const shared = data?.shared ?? [];
  const essentials = data?.essentials ?? data?.templates ?? [];

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [shareTarget, setShareTarget] = useState<Agent | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const editTarget = editTargetId
    ? agents.find((agent) => agent.id === editTargetId) ?? null
    : null;
  const myAgents = mine;
  const sharedAgents = shared as AgentWithSharing[];
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

    createAgent.mutate(formData, { onSuccess: () => setMode('list') });
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
      onSuccess: () => {
        setPendingTemplateId(null);
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
            สร้าง AI coworker
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading agents...</p>
        ) : (
          <Tabs defaultValue="essentials">
            <TabsList className="mb-5">
              <TabsTrigger value="essentials">
                Essentials
                {essentials.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                    {essentials.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="shared">
                Shared
                {sharedAgents.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                    {sharedAgents.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="essentials">
              {essentials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No essential agents available yet.</p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    AI coworker แบบพร้อมใช้สำหรับงานยอดนิยม เริ่มใช้งานได้ทันทีหรือคัดลอกไปปรับให้เข้ากับงานของคุณ
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {essentials.map((agent) => (
                      <EssentialAgentCard
                        key={agent.id}
                        agent={agent}
                        onUse={handleUseTemplate}
                        isPending={pendingTemplateId === agent.id}
                      />
                    ))}
                  </div>
                </>
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
                    isActive={isVisible(agent.id)}
                    onToggleActive={() => toggleChatVisible(agent.id)}
                    onEdit={() => openEdit(agent)}
                    onDelete={() => setDeleteTarget(agent)}
                    onShare={() => setShareTarget(agent)}
                    onChat={() => startChatWithAgent(agent.id)}
                    updateAvailable={getTemplateUpdateState(agent)}
                  />
                ))}
              </div>

              {myAgents.length === 0 && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  ยังไม่มี AI coworker ที่คุณสร้างเอง เริ่มจาก Essentials หรือสร้างใหม่สำหรับงานเฉพาะของคุณ
                </p>
              )}
            </TabsContent>

            <TabsContent value="shared">
              {sharedAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มี AI coworker ที่ถูกแชร์ให้คุณ</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {sharedAgents.map((agent) => (
                    <SharedAgentCard
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
