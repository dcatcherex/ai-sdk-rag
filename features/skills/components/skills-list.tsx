'use client';

import { useState } from 'react';
import {
  EyeIcon,
  DownloadIcon,
  GlobeIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  useSkills,
  useCreateSkill,
  useSkillDetail,
  useUpdateSkill,
  useDeleteSkill,
  useImportSkill,
  useInstallSkill,
} from '../hooks/use-skills';
import { SkillFormDialog } from './skill-form-dialog';
import type { CreateSkillInput, Skill, SkillDetail } from '../types';

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
  const importSkill = useImportSkill();
  const installSkill = useInstallSkill();
  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id;

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [detailTarget, setDetailTarget] = useState<Skill | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState('');
  const { data: detailSkill, isLoading: detailLoading } = useSkillDetail(detailTarget?.id ?? null);

  const mySkills = skills.filter((s) => s.userId === currentUserId);
  const communitySkills = skills.filter((s) => s.userId !== currentUserId && s.isPublic);

  const handleFormSubmit = (data: CreateSkillInput) => {
    if (editTarget) {
      updateSkill.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setFormOpen(false); setEditTarget(null); } },
      );
    } else {
      createSkill.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleImport = () => {
    setImportError('');
    importSkill.mutate(importUrl.trim(), {
      onSuccess: () => {
        setImportOpen(false);
        setImportUrl('');
      },
      onError: (err) => setImportError(err.message),
    });
  };

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (skill: Skill) => { setEditTarget(skill); setFormOpen(true); };

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
              onClick={() => { setImportError(''); setImportOpen(true); }}
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
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <SparklesIcon className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium">No skills yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Create a skill to give agents reusable behaviors triggered by slash commands or keywords. Or import one from GitHub.
                </p>
                <Button onClick={openCreate} size="sm" className="gap-1.5 mt-1">
                  <PlusIcon className="size-4" />
                  Create your first skill
                </Button>
              </div>
            ) : (
              <SkillGrid skills={mySkills} isOwner onEdit={openEdit} onDelete={setDeleteTarget} onView={setDetailTarget} />
            )}
          </TabsContent>

          <TabsContent value="community">
            {communitySkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted p-4">
                  <GlobeIcon className="size-8 text-muted-foreground" />
                </div>
                <p className="font-medium">No public skills yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Be the first to share a skill with the community by marking it public.
                </p>
              </div>
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

      {/* Create / Edit dialog */}
      <SkillFormDialog
        open={formOpen}
        skill={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSubmit={handleFormSubmit}
        isPending={createSkill.isPending || updateSkill.isPending}
      />

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteSkill.mutate(deleteTarget!.id, { onSuccess: () => setDeleteTarget(null) })}
              disabled={deleteSkill.isPending}
            >
              {deleteSkill.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from GitHub dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) setImportOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import skill from GitHub</DialogTitle>
            <DialogDescription>
              Paste a GitHub link to a skill folder or <code className="text-xs">SKILL.md</code> file. The skill package will be imported and any bundled text files will be stored with it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="https://github.com/user/repo/tree/main/.agents/skills/my-skill"
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(''); }}
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              onClick={handleImport}
              disabled={!importUrl.trim() || importSkill.isPending}
            >
              {importSkill.isPending ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailTarget)} onOpenChange={(open) => { if (!open) setDetailTarget(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailTarget?.name ?? 'Skill details'}</DialogTitle>
            <DialogDescription>
              {detailSkill?.skillKind === 'package'
                ? 'This imported package keeps its bundled files and sync metadata.'
                : 'This skill is stored as an inline prompt behavior.'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : detailSkill ? (
            <SkillDetailContent skill={detailSkill} />
          ) : (
            <p className="text-sm text-muted-foreground">No skill details available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Skill grid ────────────────────────────────────────────────────────────────

type SkillGridProps = {
  skills: Skill[];
  isOwner: boolean;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  onInstall?: (id: string) => void;
  onView?: (skill: Skill) => void;
  installingId?: string;
};

const SkillGrid = ({ skills, isOwner, onEdit, onDelete, onInstall, onView, installingId }: SkillGridProps) => (
  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {skills.map((skill) => (
      <div
        key={skill.id}
        className="group relative flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/30 p-4 transition hover:bg-muted/50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SparklesIcon className="size-4 shrink-0 text-primary" />
            <span className="font-medium truncate text-sm">{skill.name}</span>
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit?.(skill)}>
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => onDelete?.(skill)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {skill.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
        )}

        {!isOwner && (skill as Skill & { ownerName?: string }).ownerName && (
          <p className="text-xs text-muted-foreground">
            By {(skill as Skill & { ownerName?: string }).ownerName}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          <Badge variant="secondary" className="text-[11px]">
            {TRIGGER_LABELS[skill.triggerType] ?? skill.triggerType}
            {skill.trigger ? `: ${skill.trigger}` : ''}
          </Badge>
          {skill.skillKind === 'package' && (
            <Badge variant="outline" className="text-[11px]">
              Package
            </Badge>
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
          {skill.hasBundledFiles && (
            <Badge variant="outline" className="text-[11px]">
              Bundled files
            </Badge>
          )}
          {skill.syncStatus !== 'local' && (
            <Badge variant="outline" className="text-[11px]">
              {skill.syncStatus.replace('_', ' ')}
            </Badge>
          )}
        </div>

        <div className="mt-1 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => onView?.(skill)}
          >
            <EyeIcon className="size-3" />
            Details
          </Button>

          {!isOwner && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onInstall?.(skill.id)}
              disabled={installingId === skill.id}
            >
              <DownloadIcon className="size-3" />
              {installingId === skill.id ? 'Installing…' : 'Install'}
            </Button>
          )}
        </div>
      </div>
    ))}
  </div>
);

const SkillDetailContent = ({ skill }: { skill: SkillDetail }) => {
  const files = skill.files;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{skill.skillKind}</Badge>
        <Badge variant="outline">{skill.activationMode}</Badge>
        <Badge variant="outline">{skill.syncStatus}</Badge>
        {skill.source?.repoName && (
          <Badge variant="outline">{skill.source.repoOwner}/{skill.source.repoName}</Badge>
        )}
      </div>

      {skill.description && (
        <p className="text-sm text-muted-foreground">{skill.description}</p>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Prompt instructions</p>
        <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs whitespace-pre-wrap dark:border-border">
          {skill.promptFragment || 'No prompt content stored.'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Source</p>
          <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs dark:border-border">
            <p>{skill.sourceUrl ?? skill.source?.canonicalUrl ?? 'Local skill'}</p>
            {skill.installedRef && <p className="text-muted-foreground mt-1">Ref: {skill.installedRef}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Package info</p>
          <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs dark:border-border">
            <p>Entry file: {skill.entryFilePath}</p>
            <p className="mt-1">Bundled files: {files.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Bundled files</p>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bundled files stored for this skill.</p>
        ) : (
          <div className="rounded-md border border-black/5 dark:border-border divide-y">
            {files.map((file) => (
              <div key={file.id} className="p-3 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{file.relativePath}</span>
                  <Badge variant="outline" className="text-[11px]">{file.fileKind}</Badge>
                  {file.mediaType && <span className="text-muted-foreground">{file.mediaType}</span>}
                </div>
                {file.textContent ? (
                  <div className="rounded bg-muted/60 p-2 whitespace-pre-wrap line-clamp-6">
                    {file.textContent}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Content not stored inline for this file.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
