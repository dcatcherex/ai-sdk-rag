'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { requestWorkspaceTextAssist } from '@/features/workspace-ai/client';
import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardCopyIcon,
  Code2Icon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  SaveIcon,
  Settings2Icon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  ZapIcon,
} from 'lucide-react';
import { AiAssistButton } from '@/features/workspace-ai/components/ai-assist-button';
import { AiSuggestionDialog } from '@/features/workspace-ai/components/ai-suggestion-dialog';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
import { ButtonGroup } from '@/components/ui/button-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/page-header';
import { SettingsShell, type SettingsShellItem } from '@/components/settings-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import {
  useCreateSkillFile,
  useDeleteSkillFile,
  useSkillFileContent,
  useSkillFiles,
  useUpdateSkillFileContent,
} from '../hooks/use-skills';
import type { WorkspaceTextAssistResult } from '@/features/workspace-ai/types';
import type {
  CreateSkillFileInput,
  CreateSkillInput,
  Skill,
  SkillActivationMode,
  SkillTriggerType,
} from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type SkillEditorSectionId = 'general' | 'behavior' | 'files' | 'sharing';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toSkillSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const parseMetadata = (input: string): Record<string, string> => {
  const entries = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separator = line.indexOf(':');
      if (separator === -1) return [];
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return key && value ? [[key, value] as const] : [];
    });
  return Object.fromEntries(entries);
};

const createDefaultFiles = (): CreateSkillFileInput[] => [
  { relativePath: 'references/REFERENCE.md', textContent: '# Reference\n\nAdd detailed reference material, workflows, edge cases, and examples here.' },
  { relativePath: 'assets/README.md', textContent: '# Assets\n\nStore templates, schemas, examples, or static resources referenced by SKILL.md here.' },
  { relativePath: 'scripts/README.md', textContent: '# Scripts\n\nDocument any bundled scripts and how the agent should run them.' },
  { relativePath: 'LICENSE.txt', textContent: '' },
];

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

// ── FilesTab ──────────────────────────────────────────────────────────────────

const FilesTab = ({ skill }: { skill: Skill }) => {
  const skillId = skill.id;
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
    if (sortedFiles.length === 0) {
      setSelectedPath(null);
      return;
    }
    setSelectedPath((current) => {
      if (current && sortedFiles.some((f) => f.relativePath === current)) return current;
      const entry = sortedFiles.find((f) => f.relativePath === skill.entryFilePath);
      return entry?.relativePath ?? sortedFiles[0]?.relativePath ?? null;
    });
  }, [skill.entryFilePath, sortedFiles]);

  const { data: selectedFile, isLoading: contentLoading } = useSkillFileContent(skillId, selectedPath);

  useEffect(() => {
    setDraftContent(selectedFile?.textContent ?? '');
    setLocalError(null);
  }, [selectedFile?.relativePath, selectedFile?.textContent]);

  const isSaving = updateFile.isPending;
  const isCreating = createFile.isPending;
  const isDeleting = deleteFile.isPending;
  const isEntryFile = selectedPath === skill.entryFilePath;
  const isDirty = draftContent !== (selectedFile?.textContent ?? '');
  const fileError =
    getErrorMessage(updateFile.error) ??
    getErrorMessage(deleteFile.error) ??
    getErrorMessage(createFile.error) ??
    localError;

  const handleCreateFile = () => {
    if (newPath.trim().length === 0) { setLocalError('Enter a relative file path.'); return; }
    setLocalError(null);
    createFile.mutate(
      { skillId, path: newPath.trim(), textContent: newContent },
      { onSuccess: (file) => { setNewPath(''); setNewContent(''); setSelectedPath(file.relativePath); } },
    );
  };

  const handleSaveFile = () => {
    if (!selectedPath) return;
    setLocalError(null);
    updateFile.mutate({ skillId, path: selectedPath, textContent: draftContent });
  };

  const handleDeleteFile = () => {
    if (!selectedPath || isEntryFile) return;
    if (!window.confirm(`Delete ${selectedPath}?`)) return;
    setLocalError(null);
    deleteFile.mutate(
      { skillId, path: selectedPath },
      {
        onSuccess: () => {
          const remaining = sortedFiles.filter((f) => f.relativePath !== selectedPath);
          const entry = remaining.find((f) => f.relativePath === skill.entryFilePath);
          setSelectedPath(entry?.relativePath ?? remaining[0]?.relativePath ?? null);
        },
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden p-6 gap-4">
      {/* Left sidebar — file tree + add file */}
      <div className="flex w-64 shrink-0 min-h-0 flex-col gap-4 rounded-lg border border-black/5 p-3 dark:border-border">
        <div className="space-y-2 min-h-0 flex flex-col">
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
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="references/REFERENCE.md"
            className="h-8 text-xs"
          />
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Optional file contents"
            className="min-h-20 text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="w-full gap-1"
            onClick={handleCreateFile}
            disabled={isCreating || newPath.trim().length === 0}
          >
            <FolderPlusIcon className="size-3.5" />
            {isCreating ? 'Creating…' : 'Create file'}
          </Button>
        </div>
      </div>

      {/* Right — file editor */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-black/5 p-3 dark:border-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>{selectedPath ?? 'Select a file'}</Label>
            {selectedPath && (
              <p className="mt-1 text-xs text-muted-foreground">
                {isEntryFile
                  ? 'Saving the entry file also updates the skill metadata and prompt body.'
                  : 'Bundled files stay inside the package root.'}
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
            onChange={(e) => setDraftContent(e.target.value)}
            className="min-h-0 flex-1 resize-none font-mono text-xs"
          />
        )}

        {fileError && <p className="text-xs text-destructive">{fileError}</p>}
      </div>
    </div>
  );
};

// ── SkillForm ─────────────────────────────────────────────────────────────────

type SkillFormProps = {
  skill: Skill | null;
  onBack: () => void;
  onSubmit: (data: CreateSkillInput) => void;
  isPending?: boolean;
};

const SkillForm = ({ skill, onBack, onSubmit, isPending }: SkillFormProps) => {
  const isEdit = Boolean(skill);
  const isPackage = skill?.skillKind === 'package';

  const [activeSection, setActiveSection] = useState<SkillEditorSectionId>('general');
  const [imageUrl, setImageUrl] = useState(skill?.imageUrl ?? '');
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [activationMode, setActivationMode] = useState<SkillActivationMode>(skill?.activationMode ?? 'model');
  const [triggerType, setTriggerType] = useState<SkillTriggerType>(skill?.triggerType ?? 'always');
  const [trigger, setTrigger] = useState(skill?.trigger ?? '');
  const [promptFragment, setPromptFragment] = useState(skill?.promptFragment ?? '');
  const [license, setLicense] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [files, setFiles] = useState<CreateSkillFileInput[]>(createDefaultFiles);
  const [isPublic, setIsPublic] = useState(skill?.isPublic ?? false);
  const [promptViewMode, setPromptViewMode] = useState<'edit' | 'preview'>('preview');
  const [promptCopied, setPromptCopied] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [descriptionSuggestionsOpen, setDescriptionSuggestionsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(promptFragment);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  useEffect(() => {
    if (promptViewMode === 'edit' && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [promptFragment, promptViewMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEdit) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        activationMode,
        triggerType,
        trigger: activationMode === 'rule' && triggerType !== 'always' ? trigger.trim() || undefined : undefined,
        promptFragment: promptFragment.trim(),
        imageUrl: imageUrl || null,
        isPublic,
      });
      return;
    }

    const parsedMetadata = parseMetadata(metadataText);
    onSubmit({
      name: toSkillSlug(name),
      description: description.trim(),
      activationMode,
      triggerType: activationMode === 'rule' ? triggerType : 'always',
      trigger: activationMode === 'rule' && triggerType !== 'always' ? trigger.trim() || undefined : undefined,
      promptFragment: promptFragment.trim(),
      skillKind: 'package',
      license: license.trim() || undefined,
      compatibility: compatibility.trim() || undefined,
      metadata: Object.keys(parsedMetadata).length > 0 ? parsedMetadata : undefined,
      files: files
        .map((f) => ({ relativePath: f.relativePath.trim(), textContent: f.textContent }))
        .filter((f) => f.relativePath.length > 0),
      imageUrl: imageUrl || null,
      isPublic,
    });
  };

  const normalizedName = isEdit ? name.trim() : toSkillSlug(name);
  const isValid =
    normalizedName.length > 0 &&
    description.trim().length > 0 &&
    promptFragment.trim().length > 0 &&
    (activationMode === 'model' || triggerType === 'always' || trigger.trim().length > 0);

  const triggerPlaceholder = triggerType === 'slash' ? '/email, /report …' : 'email, report …';

  const uploadSkillCover = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/skills/image', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json() as { url: string };
    return json.url;
  };

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error('Skill name is required first');
      return;
    }
    if (!promptFragment.trim()) {
      toast.error('Skill instructions are required first', {
        description: 'Add the prompt instructions before asking AI to write a description.',
      });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const result = await requestWorkspaceTextAssist('skill-description', {
        context: {
          entityType: 'skill',
          entityId: skill?.id,
          name,
          promptFragment,
          currentValue: description,
        },
      });

      if (result.suggestions.length === 0) throw new Error('No description returned');
      setDescriptionSuggestions(result.suggestions);
      setDescriptionSuggestionsOpen(true);
    } catch (error) {
      toast.error('Failed to generate description', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Dynamic sections — inline skills have no Files section
  const sections = useMemo((): SettingsShellItem<SkillEditorSectionId>[] => {
    const base: SettingsShellItem<SkillEditorSectionId>[] = [
      { id: 'general', icon: Settings2Icon, label: 'General', description: 'Cover image, name, and description.' },
      { id: 'behavior', icon: ZapIcon, label: 'Behavior', description: 'Activation mode, trigger settings, and prompt instructions.' },
    ];
    if (!isEdit || isPackage) {
      base.push({
        id: 'files',
        icon: FolderIcon,
        label: 'Files',
        description: isEdit && isPackage
          ? 'Manage bundled reference, asset, and script files.'
          : 'License, metadata, and initial bundled files.',
      });
    }
    base.push({ id: 'sharing', icon: Share2Icon, label: 'Sharing', description: 'Control visibility and community sharing settings.' });
    return base;
  }, [isEdit, isPackage]);

  const resolvedSection = sections.some((s) => s.id === activeSection) ? activeSection : 'general';
  const activeMeta = sections.find((s) => s.id === resolvedSection);

  // Files section in edit mode uses its own inline save controls — no form footer needed
  const showFooter = !(isEdit && resolvedSection === 'files');

  // ── Section content ──────────────────────────────────────────────────────────

  const generalContent = (
    <div className="space-y-5 max-w-lg">
      <ImageUploadZone
        value={imageUrl}
        onChange={setImageUrl}
        onUpload={uploadSkillCover}
        label="Cover image"
        hint="Optional. Shown on the skill card."
      />

      <div className="space-y-1.5">
        <Label htmlFor="skill-name">Name *</Label>
        <Input
          id="skill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="email-drafter"
          maxLength={64}
          required
        />
        {!isEdit && (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens. Saved as <code>{normalizedName || 'skill-name'}</code>.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="skill-description">Description *</Label>
          <AiAssistButton
            onClick={() => { void handleGenerateDescription(); }}
            isLoading={isGeneratingDescription}
            idleLabel="Write with AI"
            loadingLabel="Writing..."
          />
        </div>
        <Input
          id="skill-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this skill does and when to use it."
          maxLength={1024}
          required
        />
        <p className="text-xs text-muted-foreground">
          Used for skill discovery. Describe what the skill does and when it should be activated.
        </p>
      </div>
    </div>
  );

  const behaviorContent = (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label>Activation mode</Label>
        <Select value={activationMode} onValueChange={(v) => setActivationMode(v as SkillActivationMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rule">Rule-based</SelectItem>
            <SelectItem value="model">Model discovered</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {activationMode === 'rule'
            ? 'Optional harness-specific fallback activation. The Agent Skills standard primarily relies on catalog discovery.'
            : 'Recommended for standard skills: the model discovers the skill from its name and description, then loads SKILL.md on activation.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Trigger type</Label>
        <Select value={triggerType} onValueChange={(v) => setTriggerType(v as SkillTriggerType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always active</SelectItem>
            <SelectItem value="slash">Slash command (e.g. /email)</SelectItem>
            <SelectItem value="keyword">Keyword match</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {activationMode === 'model' && 'Optional compatibility metadata for this app. Standard package skills do not require explicit trigger rules.'}
          {activationMode === 'rule' && triggerType === 'always' && 'This skill is always injected when the agent is active.'}
          {activationMode === 'rule' && triggerType === 'slash' && 'Skill activates when the user starts their message with the slash command.'}
          {activationMode === 'rule' && triggerType === 'keyword' && 'Skill activates when the user message contains the keyword.'}
        </p>
      </div>

      {activationMode === 'rule' && triggerType !== 'always' && (
        <div className="space-y-1.5">
          <Label htmlFor="skill-trigger">
            {triggerType === 'slash' ? 'Slash command *' : 'Keyword *'}
          </Label>
          <Input
            id="skill-trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder={triggerPlaceholder}
            maxLength={100}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Label htmlFor="skill-prompt" className="shrink-0">Prompt instructions *</Label>
          <div className="ml-auto">
            <ButtonGroup className="border rounded-full bg-muted/50 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`size-7 rounded-full ${promptViewMode === 'preview' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setPromptViewMode('preview')}
                title="Preview rendered markdown"
              >
                <EyeIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`size-7 rounded-full ${promptViewMode === 'edit' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setPromptViewMode('edit')}
                title="Edit raw markdown"
              >
                <Code2Icon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={copyPrompt}
                title="Copy to clipboard"
              >
                {promptCopied
                  ? <CheckIcon className="size-3.5 text-green-500" />
                  : <ClipboardCopyIcon className="size-3.5" />}
              </Button>
            </ButtonGroup>
          </div>
        </div>

        <div className="rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <ScrollArea className="h-[32rem]">
            {promptViewMode === 'edit' ? (
              <textarea
                ref={textareaRef}
                id="skill-prompt"
                value={promptFragment}
                onChange={(e) => {
                  setPromptFragment(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="Explain when to use the skill, the workflow to follow, supporting files to read, and any scripts to run."
                className="w-full min-h-48 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                required
              />
            ) : (
              <div className="min-h-48 px-3 py-2 text-sm">
                {promptFragment.trim()
                  ? <MarkdownText content={promptFragment} />
                  : <p className="text-muted-foreground italic text-xs">Nothing to preview yet.</p>}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );

  const createFilesContent = (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="skill-license">License</Label>
        <Input
          id="skill-license"
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="Apache-2.0 or Proprietary. See LICENSE.txt"
          maxLength={300}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skill-compatibility">Compatibility</Label>
        <Input
          id="skill-compatibility"
          value={compatibility}
          onChange={(e) => setCompatibility(e.target.value)}
          placeholder="Requires Node.js 20+, git, and internet access"
          maxLength={500}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skill-metadata">Metadata</Label>
        <Textarea
          id="skill-metadata"
          value={metadataText}
          onChange={(e) => setMetadataText(e.target.value)}
          placeholder={'author: your-team\nversion: 1.0.0'}
          className="min-h-20 resize-none"
        />
        <p className="text-xs text-muted-foreground">One <code>key: value</code> pair per line.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-black/5 p-3 dark:border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>Bundled files</Label>
            <p className="text-xs text-muted-foreground">
              Standard skills are directories. Add supporting files using relative paths from the skill root.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setFiles((prev) => [...prev, { relativePath: '', textContent: '' }])}
          >
            <PlusIcon className="size-3.5" />
            Add file
          </Button>
        </div>
        <div className="space-y-3">
          {files.map((file, index) => (
            <div key={`${file.relativePath}-${index}`} className="space-y-2 rounded-md border border-black/5 p-3 dark:border-border">
              <div className="flex items-center gap-2">
                <Input
                  value={file.relativePath}
                  onChange={(e) =>
                    setFiles((prev) =>
                      prev.map((entry, i) => i === index ? { ...entry, relativePath: e.target.value } : entry)
                    )
                  }
                  placeholder="references/REFERENCE.md"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
              <Textarea
                value={file.textContent}
                onChange={(e) =>
                  setFiles((prev) =>
                    prev.map((entry, i) => i === index ? { ...entry, textContent: e.target.value } : entry)
                  )
                }
                placeholder="Optional file contents"
                className="min-h-24 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const sharingContent = (
    <div className="max-w-lg">
      <div className="flex items-center justify-between rounded-lg border border-black/5 dark:border-border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="skill-public" className="text-sm font-medium cursor-pointer">
            Share publicly
          </Label>
          <p className="text-xs text-muted-foreground">
            Other users can browse and install this skill from the community gallery.
          </p>
        </div>
        <Switch id="skill-public" checked={isPublic} onCheckedChange={setIsPublic} />
      </div>
    </div>
  );

  const sectionContent: Record<SkillEditorSectionId, React.ReactNode> = {
    general: generalContent,
    behavior: behaviorContent,
    files: isEdit && skill ? <FilesTab skill={skill} /> : createFilesContent,
    sharing: sharingContent,
  };

  // FilesTab (edit mode) manages its own layout — remove SettingsShell padding/scroll
  const isEditFilesSection = isEdit && resolvedSection === 'files';

  return (
    <>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SettingsShell
        activeItem={resolvedSection}
        items={sections}
        onItemChange={setActiveSection}
        sectionTitle={activeMeta?.label ?? ''}
        sectionDescription={activeMeta?.description}
        sidebarLabel="Settings"
        contentClassName={isEditFilesSection ? 'flex flex-col min-h-0 p-0 overflow-hidden' : undefined}
        footer={
          showFooter ? (
            <>
              <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || isPending}>
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create skill'}
              </Button>
            </>
          ) : null
        }
        >
          {sectionContent[resolvedSection]}
        </SettingsShell>
      </form>

      <AiSuggestionDialog
        open={descriptionSuggestionsOpen}
        onOpenChange={setDescriptionSuggestionsOpen}
        title="Skill Description Suggestions"
        description="Choose the description that best explains when this skill should be used."
        suggestions={descriptionSuggestions}
        onSelect={(suggestion) => {
          setDescription(suggestion);
          setDescriptionSuggestionsOpen(false);
          toast.success('Skill description applied');
        }}
      />
    </>
  );
};

// ── SkillEditorPanel ──────────────────────────────────────────────────────────

type SkillEditorPanelProps = {
  skill: Skill | null;
  onBack: () => void;
  onSubmit: (data: CreateSkillInput) => void;
  isPending?: boolean;
};

export const SkillEditorPanel = ({ skill, onBack, onSubmit, isPending }: SkillEditorPanelProps) => {
  const isEdit = Boolean(skill);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={isEdit ? 'Edit Skill' : 'Create Skill'}
        description={
          isEdit
            ? 'Update name, prompt instructions, trigger settings, and manage bundled files.'
            : 'Create a reusable skill to give agents specialized knowledge and behaviors.'
        }
        icon={<SparklesIcon className="size-4" />}
        leading={
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onBack} disabled={isPending}>
            <ArrowLeftIcon className="size-4" />
            Back to Skills
          </Button>
        }
      />
      <SkillForm key={skill?.id ?? 'new'} skill={skill} onBack={onBack} onSubmit={onSubmit} isPending={isPending} />
    </div>
  );
};
