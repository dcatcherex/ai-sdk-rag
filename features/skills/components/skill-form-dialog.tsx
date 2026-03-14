'use client';

import { useEffect, useState } from 'react';
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
import type { CreateSkillInput, Skill, SkillTriggerType } from '../types';

type Props = {
  open: boolean;
  skill?: Skill | null;
  onClose: () => void;
  onSubmit: (data: CreateSkillInput) => void;
  isPending?: boolean;
};

export const SkillFormDialog = ({ open, skill, onClose, onSubmit, isPending }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<SkillTriggerType>('keyword');
  const [trigger, setTrigger] = useState('');
  const [promptFragment, setPromptFragment] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description ?? '');
      setTriggerType(skill.triggerType);
      setTrigger(skill.trigger ?? '');
      setPromptFragment(skill.promptFragment);
      setIsPublic(skill.isPublic);
    } else {
      setName('');
      setDescription('');
      setTriggerType('keyword');
      setTrigger('');
      setPromptFragment('');
      setIsPublic(false);
    }
  }, [skill, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType,
      trigger: triggerType !== 'always' ? trigger.trim() || undefined : undefined,
      promptFragment: promptFragment.trim(),
      isPublic,
    });
  };

  const isValid = name.trim().length > 0 && promptFragment.trim().length > 0 &&
    (triggerType === 'always' || trigger.trim().length > 0);

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
              placeholder="e.g. Email Drafter"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-description">Description</Label>
            <Input
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this skill do?"
              maxLength={300}
            />
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
              {triggerType === 'always' && 'This skill is always injected when the agent is active.'}
              {triggerType === 'slash' && 'Skill activates when the user starts their message with the slash command.'}
              {triggerType === 'keyword' && 'Skill activates when the user message contains the keyword.'}
            </p>
          </div>

          {triggerType !== 'always' && (
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
              These instructions are appended to the agent&apos;s system prompt when this skill is triggered.
            </p>
            <Textarea
              id="skill-prompt"
              value={promptFragment}
              onChange={(e) => setPromptFragment(e.target.value)}
              placeholder="When writing an email, always use a professional tone. Structure the email with a subject line, greeting, body, and sign-off…"
              className="min-h-32 resize-none"
              required
            />
          </div>

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
