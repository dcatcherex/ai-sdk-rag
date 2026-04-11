'use client';

import { useMemo } from 'react';
import { IMAGE_MODEL_CONFIGS } from '@/features/image/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type AiImageAssistDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  instruction: string;
  onInstructionChange: (value: string) => void;
  modelId: string;
  onModelIdChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
};

export function AiImageAssistDialog({
  open,
  onOpenChange,
  title,
  description,
  instruction,
  onInstructionChange,
  modelId,
  onModelIdChange,
  aspectRatio,
  onAspectRatioChange,
  onGenerate,
  isGenerating = false,
}: AiImageAssistDialogProps) {
  const models = useMemo(
    () => IMAGE_MODEL_CONFIGS.filter((config) => !config.requiresImages && (config.mode === 'generate' || config.mode === 'both')),
    [],
  );

  const selectedModel = models.find((config) => config.id === modelId) ?? models[0];
  const aspectRatios = selectedModel?.aspectRatios ?? ['1:1'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-ai-image-instruction">Visual direction</Label>
            <Textarea
              id="workspace-ai-image-instruction"
              value={instruction}
              onChange={(event) => onInstructionChange(event.target.value)}
              placeholder="Optional style or mood guidance..."
              rows={4}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Image model</Label>
              <Select
                value={modelId}
                onValueChange={(value) => {
                  onModelIdChange(value);
                  const nextModel = models.find((config) => config.id === value);
                  const nextAspect = nextModel?.aspectRatios[0] ?? '1:1';
                  onAspectRatioChange(nextModel?.aspectRatios.includes(aspectRatio) ? aspectRatio : nextAspect);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Aspect ratio</Label>
              <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aspectRatios.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {ratio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
