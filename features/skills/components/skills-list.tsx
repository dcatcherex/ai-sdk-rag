'use client';

import { useState } from 'react';
import {
  DownloadIcon,
  EyeIcon,
  GlobeIcon,
  LinkIcon,
  PlusIcon,
  SparklesIcon,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/lib/auth-client';
import { AgentCard } from '@/features/agents/components/agent-card';
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  useInstallSkill,
} from '../hooks/use-skills';
import { SkillEditorPanel } from './skill-editor-panel';
import { SkillImportDialog } from './skill-import-dialog';
import { SkillDetailDialog } from './skill-detail-dialog';
import type { CreateSkillInput, Skill } from '../types';

const TRIGGER_LABELS: Record<string, string> = {
  always: 'Always',
  slash: 'Slash',
  keyword: 'Keyword',
};

export const SkillsList = () => {
  const { data: skills = [], isLoading } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();
  const installSkill = useInstallSkill();
  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id;

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [detailTarget, setDetailTarget] = useState<Skill | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const mySkills = skills.filter((s) => s.userId === currentUserId);
  const communitySkills = skills.filter((s) => s.userId !== currentUserId && s.isPublic);

  const handleFormSubmit = (data: CreateSkillInput) => {
    if (editTarget) {
      updateSkill.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setMode('list'); setEditTarget(null); } },
      );
    } else {
      createSkill.mutate(data, { onSuccess: () => setMode('list') });
    }
  };

  const openCreate = () => { setEditTarget(null); setMode('create'); };
  const openEdit = (skill: Skill) => { setEditTarget(skill); setMode('edit'); };
  const closeEditor = () => { setMode('list'); setEditTarget(null); };

  if (mode !== 'list') {
    return (
      <SkillEditorPanel
        skill={mode === 'edit' ? editTarget : null}
        onBack={closeEditor}
        onSubmit={handleFormSubmit}
        isPending={createSkill.isPending || updateSkill.isPending}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Skills"
        description="Reusable prompt behaviors you can attach to agents"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setImportOpen(true)}
            >
              <LinkIcon className="size-4" />
              Import from GitHub
            </Button>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <PlusIcon className="size-4" />
              New skill
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="mine">
          <TabsList className="mb-4">
            <TabsTrigger value="mine">My skills ({mySkills.length})</TabsTrigger>
            <TabsTrigger value="community">Community ({communitySkills.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="mine">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : mySkills.length === 0 ? (
              <EmptyMySkills onCreate={openCreate} />
            ) : (
              <SkillGrid
                skills={mySkills}
                isOwner
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onView={setDetailTarget}
              />
            )}
          </TabsContent>

          <TabsContent value="community">
            {communitySkills.length === 0 ? (
              <EmptyCommunitySkills />
            ) : (
              <SkillGrid
                skills={communitySkills}
                isOwner={false}
                onInstall={(id) => installSkill.mutate(id)}
                installingId={installSkill.isPending ? installSkill.variables : undefined}
                onView={setDetailTarget}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete skill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">&ldquo;{deleteTarget?.name}&rdquo;</span>?
              Agents using this skill will lose it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteSkill.mutate(deleteTarget!.id, {
                  onSuccess: () => setDeleteTarget(null),
                })
              }
              disabled={deleteSkill.isPending}
            >
              {deleteSkill.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <SkillDetailDialog
        skill={detailTarget}
        currentUserId={currentUserId}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
};

// ── Empty states ───────────────────────────────────────────────────────────────

const EmptyMySkills = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <SparklesIcon className="size-8 text-muted-foreground" />
    </div>
    <p className="font-medium">No skills yet</p>
    <p className="text-sm text-muted-foreground max-w-xs">
      Create a skill to give agents reusable behaviors triggered by slash
      commands or keywords. Or import one from GitHub.
    </p>
    <Button onClick={onCreate} size="sm" className="gap-1.5 mt-1">
      <PlusIcon className="size-4" />
      Create your first skill
    </Button>
  </div>
);

const EmptyCommunitySkills = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <GlobeIcon className="size-8 text-muted-foreground" />
    </div>
    <p className="font-medium">No public skills yet</p>
    <p className="text-sm text-muted-foreground max-w-xs">
      Be the first to share a skill with the community by marking it public.
    </p>
  </div>
);

// ── Skill grid ─────────────────────────────────────────────────────────────────

type SkillGridProps = {
  skills: Skill[];
  isOwner: boolean;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  onInstall?: (id: string) => void;
  onView?: (skill: Skill) => void;
  installingId?: string;
};

const SkillBadges = ({ skill, isOwner }: { skill: Skill; isOwner: boolean }) => (
  <div className="flex flex-wrap gap-1.5">
    <Badge variant="secondary" className="text-[11px]">
      {TRIGGER_LABELS[skill.triggerType] ?? skill.triggerType}
      {skill.trigger ? `: ${skill.trigger}` : ''}
    </Badge>
    {skill.skillKind === 'package' && (
      <Badge variant="outline" className="text-[11px]">Package</Badge>
    )}
    {skill.isPublic && isOwner && (
      <Badge variant="secondary" className="text-[11px] gap-1">
        <GlobeIcon className="size-2.5" /> Public
      </Badge>
    )}
    {skill.sourceUrl && (
      <Badge variant="outline" className="text-[11px] gap-1">
        <LinkIcon className="size-2.5" /> Imported
      </Badge>
    )}
    {skill.syncStatus !== 'local' && (
      <Badge variant="outline" className="text-[11px]">
        {skill.syncStatus.replace('_', ' ')}
      </Badge>
    )}
  </div>
);

const SkillGrid = ({
  skills,
  isOwner,
  onEdit,
  onDelete,
  onInstall,
  onView,
  installingId,
}: SkillGridProps) => (
  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
    {skills.map((skill) => {
      const ownerName = (skill as Skill & { ownerName?: string }).ownerName;
      const description =
        !isOwner && ownerName
          ? `${skill.description ?? ''}\nBy ${ownerName}`.trim()
          : skill.description;

      return (
        <AgentCard
          key={skill.id}
          icon={SparklesIcon}
          name={skill.name}
          description={description}
          imageUrl={skill.imageUrl}
          isPublic={skill.isPublic && isOwner}
          onEdit={isOwner ? () => onEdit?.(skill) : undefined}
          onDelete={isOwner ? () => onDelete?.(skill) : undefined}
          footer={
            isOwner ? (
              <SkillBadges skill={skill} isOwner={isOwner} />
            ) : (
              <div className="flex flex-col gap-2">
                <SkillBadges skill={skill} isOwner={isOwner} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-1 text-xs gap-1"
                    onClick={() => onView?.(skill)}
                  >
                    <EyeIcon className="size-3" />
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs gap-1"
                    onClick={() => onInstall?.(skill.id)}
                    disabled={installingId === skill.id}
                  >
                    <DownloadIcon className="size-3" />
                    {installingId === skill.id ? 'Installing…' : 'Install'}
                  </Button>
                </div>
              </div>
            )
          }
        />
      );
    })}
  </div>
);
