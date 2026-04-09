'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, ClipboardCopyIcon, Code2Icon, EyeIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
import { ButtonGroup } from '@/components/ui/button-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { CreateSkillFileInput, CreateSkillInput, Skill, SkillActivationMode, SkillTriggerType } from '../types';

type Props = {
  open: boolean;
  skill?: Skill | null;
  onClose: () => void;
  onSubmit: (data: CreateSkillInput) => void;
  isPending?: boolean;
};

const createDefaultFiles = (): CreateSkillFileInput[] => [
  {
    relativePath: 'references/REFERENCE.md',
    textContent: '# Reference\n\nAdd detailed reference material, workflows, edge cases, and examples here.',
  },
  {
    relativePath: 'assets/README.md',
    textContent: '# Assets\n\nStore templates, schemas, examples, or static resources referenced by SKILL.md here.',
  },
  {
    relativePath: 'scripts/README.md',
    textContent: '# Scripts\n\nDocument any bundled scripts and how the agent should run them.',
  },
  {
    relativePath: 'LICENSE.txt',
    textContent: '',
  },
];

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

export const SkillFormDialog = ({ open, skill, onClose, onSubmit, isPending }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activationMode, setActivationMode] = useState<SkillActivationMode>('model');
  const [triggerType, setTriggerType] = useState<SkillTriggerType>('always');
  const [trigger, setTrigger] = useState('');
  const [promptFragment, setPromptFragment] = useState('');
  const [license, setLicense] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [files, setFiles] = useState<CreateSkillFileInput[]>(createDefaultFiles);
  const [isPublic, setIsPublic] = useState(false);
  const [promptViewMode, setPromptViewMode] = useState<'edit' | 'preview'>('edit');
  const [promptCopied, setPromptCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(promptFragment);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description ?? '');
      setActivationMode(skill.activationMode);
      setTriggerType(skill.triggerType);
      setTrigger(skill.trigger ?? '');
      setPromptFragment(skill.promptFragment);
      setLicense('');
      setCompatibility('');
      setMetadataText('');
      setFiles(createDefaultFiles());
      setIsPublic(skill.isPublic);
    } else {
      setName('');
      setDescription('');
      setActivationMode('model');
      setTriggerType('always');
      setTrigger('');
      setPromptFragment('');
      setLicense('');
      setCompatibility('');
      setMetadataText('');
      setFiles(createDefaultFiles());
      setIsPublic(false);
    }
  }, [skill, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (skill) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        activationMode,
        triggerType,
        trigger: activationMode === 'rule' && triggerType !== 'always' ? trigger.trim() || undefined : undefined,
        promptFragment: promptFragment.trim(),
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
        .map((file) => ({
          relativePath: file.relativePath.trim(),
          textContent: file.textContent,
        }))
        .filter((file) => file.relativePath.length > 0),
      isPublic,
    });
  };

  const normalizedName = skill ? name.trim() : toSkillSlug(name);
  const isValid = normalizedName.length > 0 && description.trim().length > 0 &&
    promptFragment.trim().length > 0 &&
    (activationMode === 'model' || triggerType === 'always' || trigger.trim().length > 0);

  const triggerPlaceholder =
    triggerType === 'slash' ? '/email, /report …' : 'email, report …';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{skill ? 'Edit Skill' : 'Create Skill'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name *</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={skill ? 'email-drafter' : 'email-drafter'}
              maxLength={64}
              required
            />
            {!skill && (
              <p className="text-xs text-muted-foreground">
                Standard skill names use lowercase letters, numbers, and hyphens. Saved as <code>{normalizedName || 'skill-name'}</code>.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-description">Description *</Label>
            <Input
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this skill does and when to use it. Include keywords the agent can use to recognize relevant tasks."
              maxLength={1024}
              required
            />
            <p className="text-xs text-muted-foreground">
              Used for skill discovery. Describe what the skill does and when it should be activated.
            </p>
          </div>

          {!skill && (
            <>
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
                  placeholder={"author: your-team\nversion: 1.0.0"}
                  className="min-h-20 resize-none"
                />
                <p className="text-xs text-muted-foreground">One <code>key: value</code> pair per line.</p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Activation mode</Label>
            <Select value={activationMode} onValueChange={(value) => setActivationMode(value as SkillActivationMode)}>
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

          <div className="space-y-1.5">
            <Label htmlFor="skill-prompt">Prompt instructions *</Label>
            <p className="text-xs text-muted-foreground">
              This becomes the body of <code>SKILL.md</code>. Keep it focused and move deeper material into bundled reference files.
            </p>
            <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
              {/* Toolbar */}
              <div className="absolute top-2 right-2 z-10">
                <ButtonGroup className="border rounded-full bg-background/90 backdrop-blur-sm shadow-sm">
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

              <ScrollArea className="max-h-96">
                {promptViewMode === 'edit' ? (
                  <textarea
                    id="skill-prompt"
                    value={promptFragment}
                    onChange={(e) => setPromptFragment(e.target.value)}
                    placeholder="Explain when to use the skill, the workflow to follow, supporting files to read, and any scripts to run."
                    className="w-full min-h-32 resize-none bg-transparent px-3 py-2 pr-32 text-sm outline-none placeholder:text-muted-foreground"
                    required
                  />
                ) : (
                  <div className="min-h-32 px-3 py-2 pr-32 text-sm">
                    {promptFragment.trim()
                      ? <MarkdownText content={promptFragment} />
                      : <p className="text-muted-foreground italic text-xs">Nothing to preview yet.</p>}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {!skill && (
            <div className="space-y-3 rounded-lg border border-black/5 p-3 dark:border-border">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label>Bundled files</Label>
                  <p className="text-xs text-muted-foreground">
                    Standard skills are directories. Add supporting files here using relative paths from the skill root.
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
                          setFiles((prev) => prev.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, relativePath: e.target.value } : entry
                          )))
                        }
                        placeholder="references/REFERENCE.md"
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setFiles((prev) => prev.filter((_, entryIndex) => entryIndex !== index))}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={file.textContent}
                      onChange={(e) =>
                        setFiles((prev) => prev.map((entry, entryIndex) => (
                          entryIndex === index ? { ...entry, textContent: e.target.value } : entry
                        )))
                      }
                      placeholder="Optional file contents"
                      className="min-h-24 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Saving…' : skill ? 'Save changes' : 'Create skill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
