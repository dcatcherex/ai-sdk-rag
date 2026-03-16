'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PROMPT_CATEGORIES } from '../constants';
import type { Prompt, CreatePromptInput, UpdatePromptInput } from '../types';

type CreateMode = {
  mode: 'create';
  onSubmit: (data: CreatePromptInput) => void;
  isPending: boolean;
};

type EditMode = {
  mode: 'edit';
  prompt: Prompt;
  onSubmit: (data: UpdatePromptInput & { id: string }) => void;
  isPending: boolean;
};

type PromptFormProps = (CreateMode | EditMode) & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PromptForm(props: PromptFormProps) {
  const existing = props.mode === 'edit' ? props.prompt : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [category, setCategory] = useState(existing?.category ?? PROMPT_CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState(existing?.tags.join(', ') ?? '');
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (props.mode === 'create') {
      props.onSubmit({ title, content, category, tags, isPublic });
    } else {
      props.onSubmit({ id: props.prompt.id, title, content, category, tags, isPublic });
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.mode === 'create' ? 'New prompt' : 'Edit prompt'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prompt-title">Title</Label>
            <Input
              id="prompt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g. Summarize text"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt-content">
              Content
              <span className="ml-1.5 text-xs text-muted-foreground">
                Use {'{{variable}}'} for placeholders
              </span>
            </Label>
            <Textarea
              id="prompt-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your prompt here. Use {{variable}} for dynamic parts."
              className="min-h-[120px] resize-y font-mono text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="prompt-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prompt-tags">Tags (comma-separated)</Label>
              <Input
                id="prompt-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="prompt-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="prompt-public" className="cursor-pointer">
              Make public (visible to all users)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={props.isPending}>
              {props.mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
