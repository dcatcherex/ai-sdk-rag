'use client';

import { useMemo, useState } from 'react';
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
import { authClient } from '@/lib/auth-client';
import { AgentCard } from '@/features/agents/components/agent-card';
import { toast } from 'sonner';
import {
  useSkills,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  useInstallSkill,
  useUseSkillTemplate,
} from '../hooks/use-skills';
import { SkillEditorPanel } from './skill-editor-panel';
import { SkillImportDialog } from './skill-import-dialog';
import { SkillDetailDialog } from './skill-detail-dialog';
import type { CreateSkillInput, Skill } from '../types';

export const SkillsList = () => {
  const { data, isLoading } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();
  const installSkill = useInstallSkill();
  const useSkillTemplate = useUseSkillTemplate();
  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id;

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [detailTarget, setDetailTarget] = useState<Skill | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const skills = data?.skills ?? [];
  const mySkills = data?.mine ?? skills.filter((s) => s.userId === currentUserId);
  const essentialSkills = data?.essentials ?? [];
  const communitySkills = data?.community ?? skills.filter((s) => s.userId !== currentUserId && s.isPublic);
  const essentialSkillsById = useMemo(
    () => Object.fromEntries(essentialSkills.map((skill) => [skill.id, skill])),
    [essentialSkills],
  );
  const isTemplateUpdateAvailable = (skill: Skill) => {
    if (!skill.templateId || skill.sourceTemplateVersion === null) return false;
    const source = essentialSkillsById[skill.templateId];
    return Boolean(source && source.version > skill.sourceTemplateVersion);
  };
  const myUpdateCount = mySkills.filter(isTemplateUpdateAvailable).length;

  const handleFormSubmit = (formData: CreateSkillInput) => {
    if (editTarget) {
      updateSkill.mutate(
        { id: editTarget.id, ...formData },
        { onSuccess: () => { setMode('list'); setEditTarget(null); } },
      );
    } else {
      createSkill.mutate(formData, { onSuccess: () => setMode('list') });
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setMode('create');
  };

  const openEdit = (skill: Skill) => {
    setEditTarget(skill);
    setMode('edit');
  };

  const closeEditor = () => {
    setMode('list');
    setEditTarget(null);
  };

  const handleUseTemplate = (skillId: string) => {
    useSkillTemplate.mutate(skillId, {
      onSuccess: () => {
        toast.success('Skill added to your library');
      },
    });
  };

  const handleInstallSkill = (skillId: string) => {
    installSkill.mutate(skillId, {
      onSuccess: () => {
        toast.success('Skill added to your library');
      },
    });
  };

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
    <div className="flex h-full flex-col">
      <PageHeader
        title="Skills"
        description="เพิ่ม skills เพื่อให้ Vaja และ AI coworker เข้าใจงานเฉพาะทางของคุณมากขึ้น"
        action={(
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setImportOpen(true)}
            >
              <LinkIcon className="size-4" />
              นำเข้าจาก GitHub
            </Button>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <PlusIcon className="size-4" />
              สร้าง skill
            </Button>
          </div>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="essentials">
          <CountTabsList
            items={[
              { value: 'essentials', label: 'Essentials', count: essentialSkills.length },
              { value: 'mine', label: 'Mine', count: mySkills.length },
              { value: 'community', label: 'Community', count: communitySkills.length },
            ]}
          />

          <TabsContent value="essentials">
            {essentialSkills.length === 0 ? (
              <EmptyEssentialSkills />
            ) : (
              <SkillGrid
                skills={essentialSkills}
                isOwner={false}
                isTemplateCatalog
                onInstall={handleUseTemplate}
                installingId={useSkillTemplate.isPending ? useSkillTemplate.variables : undefined}
                onView={setDetailTarget}
              />
            )}
          </TabsContent>

          <TabsContent value="mine">
            {myUpdateCount > 0 && (
              <p className="mb-4 text-sm text-muted-foreground">
                {myUpdateCount} of your skills have newer official template versions available.
              </p>
            )}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : mySkills.length === 0 ? (
              <EmptyMySkills onCreate={openCreate} />
            ) : (
              <SkillGrid
                skills={mySkills}
                isOwner
                isUpdateAvailable={isTemplateUpdateAvailable}
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
                onInstall={handleInstallSkill}
                installingId={installSkill.isPending ? installSkill.variables : undefined}
                onView={setDetailTarget}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
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
              {deleteSkill.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <SkillDetailDialog
        skill={detailTarget}
        sourceTemplate={
          detailTarget?.templateId ? (essentialSkillsById[detailTarget.templateId] ?? null) : null
        }
        currentUserId={currentUserId}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
};

const EmptyMySkills = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <SparklesIcon className="size-8 text-muted-foreground" />
    </div>
    <p className="font-medium">ยังไม่มี skills</p>
    <p className="max-w-xs text-sm text-muted-foreground">
      สร้าง skill เพื่อให้ AI coworker ทำงานแบบมีบริบทมากขึ้น เช่น ใช้คำสั่งเฉพาะ งานเฉพาะ หรือความรู้เฉพาะทาง และคุณยังนำเข้าจาก GitHub ได้
    </p>
    <Button onClick={onCreate} size="sm" className="mt-1 gap-1.5">
      <PlusIcon className="size-4" />
      สร้าง skill แรกของคุณ
    </Button>
  </div>
);

const EmptyCommunitySkills = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <GlobeIcon className="size-8 text-muted-foreground" />
    </div>
    <p className="font-medium">ยังไม่มี public skills</p>
    <p className="max-w-xs text-sm text-muted-foreground">
      คุณสามารถเป็นคนแรกที่แชร์ skill ให้ชุมชนใช้งานร่วมกันได้
    </p>
  </div>
);

const EmptyEssentialSkills = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <div className="rounded-full bg-muted p-4">
      <SparklesIcon className="size-8 text-muted-foreground" />
    </div>
    <p className="font-medium">ยังไม่มี essential skills</p>
    <p className="max-w-xs text-sm text-muted-foreground">
      skill เริ่มต้นที่ทีมดูแลจัดเตรียมไว้จะปรากฏที่นี่เมื่อเผยแพร่แล้ว
    </p>
  </div>
);

type SkillGridProps = {
  skills: Skill[];
  isOwner: boolean;
  isTemplateCatalog?: boolean;
  isUpdateAvailable?: (skill: Skill) => boolean;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  onInstall?: (id: string) => void;
  onView?: (skill: Skill) => void;
  installingId?: string;
};

const SkillGrid = ({
  skills,
  isOwner,
  isTemplateCatalog = false,
  isUpdateAvailable,
  onEdit,
  onDelete,
  onInstall,
  onView,
  installingId,
}: SkillGridProps) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {skills.map((skill) => {
      const ownerName = (skill as Skill & { ownerName?: string }).ownerName;
      const updateAvailable = isUpdateAvailable?.(skill) ?? false;
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
          onHoverAction={
            !isOwner && isTemplateCatalog && installingId !== skill.id
              ? () => onInstall?.(skill.id)
              : undefined
          }
          hoverActionTitle={installingId === skill.id ? 'Using...' : 'Use'}
          className={!isOwner && isTemplateCatalog && installingId === skill.id ? 'pointer-events-none opacity-70' : undefined}
          footer={
            isOwner
              ? undefined
              : (isTemplateCatalog ? undefined : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 flex-1 gap-1 text-xs"
                    onClick={() => onView?.(skill)}
                  >
                    <EyeIcon className="size-3" />
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 gap-1 text-xs"
                    onClick={() => onInstall?.(skill.id)}
                    disabled={installingId === skill.id}
                  >
                    <DownloadIcon className="size-3" />
                    {installingId === skill.id
                      ? (isTemplateCatalog ? 'Using...' : 'Installing...')
                      : (isTemplateCatalog ? 'Use' : 'Install')}
                  </Button>
                </div>
              ))
          }
        />
      );
    })}
  </div>
);
