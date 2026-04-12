'use client';

import { useState } from 'react';
import { RefreshCwIcon, UploadIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSkillDetail, useCheckSkillSync, useApplySkillSync } from '../hooks/use-skills';
import type { Skill, SkillDetail, SkillSyncCheckResult } from '../types';

// ── Detail content ─────────────────────────────────────────────────────────────

type SkillDetailContentProps = {
  skill: SkillDetail;
  sourceTemplate: Skill | null;
  syncResult: SkillSyncCheckResult | null;
  syncError: string;
  canSync: boolean;
  onCheckSync: () => void;
  onApplySync: () => void;
  isCheckingSync: boolean;
  isApplyingSync: boolean;
};

const SkillDetailContent = ({
  skill,
  sourceTemplate,
  syncResult,
  syncError,
  canSync,
  onCheckSync,
  onApplySync,
  isCheckingSync,
  isApplyingSync,
}: SkillDetailContentProps) => {
  const updateAvailable = Boolean(
    sourceTemplate &&
    skill.templateId &&
    skill.sourceTemplateVersion !== null &&
    sourceTemplate.version > skill.sourceTemplateVersion,
  );

  return (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{skill.skillKind}</Badge>
      <Badge variant="outline">{skill.activationMode}</Badge>
      <Badge variant="outline">{skill.syncStatus}</Badge>
      {skill.templateId && skill.sourceTemplateVersion !== null && (
        <Badge variant="outline">Based on v{skill.sourceTemplateVersion}</Badge>
      )}
      {updateAvailable && (
        <Badge variant="secondary">Update available</Badge>
      )}
      {skill.source?.repoName && (
        <Badge variant="outline">
          {skill.source.repoOwner}/{skill.source.repoName}
        </Badge>
      )}
    </div>

    {skill.description && (
      <p className="text-sm text-muted-foreground">{skill.description}</p>
    )}

    {(skill.templateId || sourceTemplate) && (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Template version</p>
        <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs dark:border-border">
          <p>Current copy version: {skill.version}</p>
          {skill.sourceTemplateVersion !== null && (
            <p className="mt-1">Copied from template version: {skill.sourceTemplateVersion}</p>
          )}
          {sourceTemplate ? (
            <p className="mt-1">Latest official version: {sourceTemplate.version}</p>
          ) : null}
          {updateAvailable ? (
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              A newer official template version is available for this skill.
            </p>
          ) : null}
          {sourceTemplate?.changelog ? (
            <div className="mt-2 rounded bg-muted/60 p-2 whitespace-pre-wrap">
              {sourceTemplate.changelog}
            </div>
          ) : null}
        </div>
      </div>
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
          {skill.installedRef && (
            <p className="text-muted-foreground mt-1">Ref: {skill.installedRef}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Package info</p>
        <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs dark:border-border">
          <p>Entry file: {skill.entryFilePath}</p>
          <p className="mt-1">Bundled files: {skill.files.length}</p>
          {skill.installedCommitSha && (
            <p className="mt-1 break-all">Installed commit: {skill.installedCommitSha}</p>
          )}
          {skill.upstreamCommitSha && (
            <p className="mt-1 break-all">Upstream commit: {skill.upstreamCommitSha}</p>
          )}
          {skill.lastSyncCheckedAt && (
            <p className="mt-1">Last checked: {new Date(skill.lastSyncCheckedAt).toLocaleString()}</p>
          )}
          {skill.lastSyncedAt && (
            <p className="mt-1">Last applied: {new Date(skill.lastSyncedAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>

    {canSync && (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Upstream sync</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={onCheckSync}
              disabled={isCheckingSync || isApplyingSync}
            >
              <RefreshCwIcon className="size-3" />
              {isCheckingSync ? 'Checking…' : 'Check updates'}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onApplySync}
              disabled={
                isApplyingSync ||
                isCheckingSync ||
                ((syncResult?.changedFiles.length ?? 0) === 0 &&
                  skill.syncStatus !== 'update_available')
              }
            >
              <UploadIcon className="size-3" />
              {isApplyingSync ? 'Applying…' : 'Apply update'}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-black/5 bg-muted/30 p-3 text-xs dark:border-border">
          <p>Status: {(syncResult?.status ?? skill.syncStatus).replace('_', ' ')}</p>
          {syncResult?.checkedAt && (
            <p className="mt-1">Checked at: {new Date(syncResult.checkedAt).toLocaleString()}</p>
          )}
          {syncResult && (
            <>
              <p className="mt-1 break-all">
                Installed commit: {syncResult.installedCommitSha ?? 'unknown'}
              </p>
              <p className="mt-1 break-all">
                Upstream commit: {syncResult.upstreamCommitSha ?? 'unknown'}
              </p>
              <p className="mt-2 font-medium">Changed files</p>
              {syncResult.changedFiles.length > 0 ? (
                <div className="mt-1 rounded bg-muted/60 p-2 whitespace-pre-wrap">
                  {syncResult.changedFiles.join('\n')}
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">No upstream changes detected.</p>
              )}
            </>
          )}
          {syncError && <p className="mt-2 text-destructive">{syncError}</p>}
        </div>
      </div>
    )}

    <div className="space-y-1.5">
      <p className="text-sm font-medium">Bundled files</p>
      {skill.files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bundled files stored for this skill.</p>
      ) : (
        <div className="rounded-md border border-black/5 dark:border-border divide-y">
          {skill.files.map((file) => (
            <div key={file.id} className="p-3 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{file.relativePath}</span>
                <Badge variant="outline" className="text-[11px]">{file.fileKind}</Badge>
                {file.mediaType && (
                  <span className="text-muted-foreground">{file.mediaType}</span>
                )}
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

// ── Dialog ─────────────────────────────────────────────────────────────────────

type SkillDetailDialogProps = {
  skill: Skill | null;
  sourceTemplate: Skill | null;
  currentUserId: string | undefined;
  onClose: () => void;
};

export const SkillDetailDialog = ({ skill, sourceTemplate, currentUserId, onClose }: SkillDetailDialogProps) => {
  const checkSkillSync = useCheckSkillSync();
  const applySkillSync = useApplySkillSync();
  const [syncResult, setSyncResult] = useState<SkillSyncCheckResult | null>(null);
  const [syncError, setSyncError] = useState('');

  const { data: detailSkill, isLoading } = useSkillDetail(skill?.id ?? null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSyncResult(null);
      setSyncError('');
      onClose();
    }
  };

  const handleCheckSync = () => {
    if (!detailSkill) return;
    setSyncError('');
    checkSkillSync.mutate(detailSkill.id, {
      onSuccess: (result) => setSyncResult(result),
      onError: (error) => setSyncError(error.message),
    });
  };

  const handleApplySync = () => {
    if (!detailSkill) return;
    setSyncError('');
    applySkillSync.mutate(detailSkill.id, {
      onSuccess: (result) =>
        setSyncResult({
          status: result.status,
          installedCommitSha: result.installedCommitSha,
          upstreamCommitSha: result.upstreamCommitSha,
          changedFiles: result.changedFiles,
          checkedAt: result.checkedAt,
        }),
      onError: (error) => setSyncError(error.message),
    });
  };

  const canSync =
    detailSkill?.userId === currentUserId &&
    detailSkill?.skillKind === 'package' &&
    Boolean(detailSkill?.source);

  return (
    <Dialog open={Boolean(skill)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill?.name ?? 'Skill details'}</DialogTitle>
          <DialogDescription>
            {detailSkill?.skillKind === 'package'
              ? 'This imported package keeps its bundled files and sync metadata.'
              : 'This skill is stored as an inline prompt behavior.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : detailSkill ? (
          <SkillDetailContent
            skill={detailSkill}
            sourceTemplate={sourceTemplate}
            syncResult={syncResult}
            syncError={syncError}
            canSync={canSync}
            onCheckSync={handleCheckSync}
            onApplySync={handleApplySync}
            isCheckingSync={checkSkillSync.isPending}
            isApplyingSync={applySkillSync.isPending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No skill details available.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
