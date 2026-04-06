'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileIcon, FolderPlusIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateSkillFile,
  useDeleteSkillFile,
  useSkillFileContent,
  useSkillFiles,
  useUpdateSkillFileContent,
} from '../hooks/use-skills';
import type { Skill } from '../types';

type Props = {
  open: boolean;
  skill: Skill | null;
  onClose: () => void;
};

export const PackageSkillEditorDialog = ({ open, skill, onClose }: Props) => {
  const skillId = skill?.id ?? null;
  const { data: files = [], isLoading: filesLoading } = useSkillFiles(skillId);
  const createFile = useCreateSkillFile();
  const updateFile = useUpdateSkillFileContent();
  const deleteFile = useDeleteSkillFile();

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    [files],
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newContent, setNewContent] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedPath(null);
      setDraftContent('');
      setNewPath('');
      setNewContent('');
      setLocalError(null);
      return;
    }

    if (sortedFiles.length === 0) {
      setSelectedPath(null);
      return;
    }

    setSelectedPath((currentPath) => {
      if (currentPath && sortedFiles.some((file) => file.relativePath === currentPath)) {
        return currentPath;
      }

      const entryFile = sortedFiles.find((file) => file.relativePath === skill?.entryFilePath);
      return entryFile?.relativePath ?? sortedFiles[0]?.relativePath ?? null;
    });
  }, [open, skill?.entryFilePath, sortedFiles]);

  const { data: selectedFile, isLoading: contentLoading } = useSkillFileContent(skillId, selectedPath);

  useEffect(() => {
    setDraftContent(selectedFile?.textContent ?? '');
    setLocalError(null);
  }, [selectedFile?.relativePath, selectedFile?.textContent]);

  const isSaving = updateFile.isPending;
  const isCreating = createFile.isPending;
  const isDeleting = deleteFile.isPending;
  const selectedFileError = getErrorMessage(updateFile.error) ?? getErrorMessage(deleteFile.error) ?? getErrorMessage(createFile.error) ?? localError;
  const isEntryFile = selectedPath === skill?.entryFilePath;
  const isDirty = draftContent !== (selectedFile?.textContent ?? '');

  const handleCreateFile = () => {
    if (!skillId) {
      return;
    }

    if (newPath.trim().length === 0) {
      setLocalError('Enter a relative file path.');
      return;
    }

    setLocalError(null);
    createFile.mutate(
      {
        skillId,
        path: newPath.trim(),
        textContent: newContent,
      },
      {
        onSuccess: (file) => {
          setNewPath('');
          setNewContent('');
          setSelectedPath(file.relativePath);
        },
      },
    );
  };

  const handleSaveFile = () => {
    if (!skillId || !selectedPath) {
      return;
    }

    setLocalError(null);
    updateFile.mutate({
      skillId,
      path: selectedPath,
      textContent: draftContent,
    });
  };

  const handleDeleteFile = () => {
    if (!skillId || !selectedPath || isEntryFile) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedPath}?`);
    if (!confirmed) {
      return;
    }

    setLocalError(null);
    deleteFile.mutate(
      {
        skillId,
        path: selectedPath,
      },
      {
        onSuccess: () => {
          const remainingFiles = sortedFiles.filter((file) => file.relativePath !== selectedPath);
          const entryFile = remainingFiles.find((file) => file.relativePath === skill?.entryFilePath);
          setSelectedPath(entryFile?.relativePath ?? remainingFiles[0]?.relativePath ?? null);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{skill?.name ?? 'Package editor'}</DialogTitle>
          <DialogDescription>
            Browse bundled files, edit the entry file safely, and manage additional package files.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-4 rounded-lg border border-black/5 p-3 dark:border-border">
            <div className="space-y-2">
              <Label>Files</Label>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-black/5 dark:border-border">
                {filesLoading ? (
                  <div className="p-3 text-xs text-muted-foreground">Loading files…</div>
                ) : sortedFiles.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No bundled files stored.</div>
                ) : (
                  <div className="divide-y">
                    {sortedFiles.map((file) => {
                      const depth = file.relativePath.split('/').length - 1;
                      const isSelected = file.relativePath === selectedPath;

                      return (
                        <button
                          key={file.id}
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${isSelected ? 'bg-muted text-foreground' : 'hover:bg-muted/60 text-muted-foreground'}`}
                          style={{ paddingLeft: `${12 + depth * 14}px` }}
                          onClick={() => setSelectedPath(file.relativePath)}
                        >
                          <FileIcon className="size-3.5 shrink-0" />
                          <span className="min-w-0 truncate font-mono">{file.relativePath}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-black/5 p-3 dark:border-border">
              <div className="flex items-center gap-2">
                <FolderPlusIcon className="size-4 text-muted-foreground" />
                <Label>Add file</Label>
              </div>
              <Input
                value={newPath}
                onChange={(event) => setNewPath(event.target.value)}
                placeholder="references/REFERENCE.md"
                className="h-8 text-xs"
              />
              <Textarea
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                placeholder="Optional file contents"
                className="min-h-24 text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="w-full gap-1"
                onClick={handleCreateFile}
                disabled={!skillId || isCreating || newPath.trim().length === 0}
              >
                <FolderPlusIcon className="size-3.5" />
                {isCreating ? 'Creating…' : 'Create file'}
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 rounded-lg border border-black/5 p-3 dark:border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>{selectedPath ?? 'Select a file'}</Label>
                {selectedPath && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isEntryFile ? 'Saving the entry file also updates the skill metadata and prompt body.' : 'Bundled files stay inside the package root.'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={handleDeleteFile}
                  disabled={!selectedPath || isEntryFile || isDeleting}
                >
                  <Trash2Icon className="size-3.5" />
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={handleSaveFile}
                  disabled={!selectedPath || isSaving || !isDirty}
                >
                  <SaveIcon className="size-3.5" />
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            {!selectedPath ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-black/10 text-sm text-muted-foreground dark:border-border">
                Select a bundled file to edit.
              </div>
            ) : contentLoading ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-black/10 text-sm text-muted-foreground dark:border-border">
                Loading file content…
              </div>
            ) : (
              <Textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                className="min-h-0 flex-1 resize-none font-mono text-xs"
              />
            )}

            {selectedFileError && (
              <p className="text-xs text-destructive">{selectedFileError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  return null;
}
