'use client';

import { useState, type KeyboardEvent, type RefObject } from 'react';
import { PlusIcon, WandSparklesIcon, XIcon } from 'lucide-react';
import { AiAssistButton } from '@/features/workspace-ai/components/ai-assist-button';
import { AiImageAssistDialog } from '@/features/workspace-ai/components/ai-image-assist-dialog';
import { availableModels } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CoverImageOptions = {
  instruction?: string;
  modelId?: string;
  aspectRatio?: string;
};

type AgentGeneralSectionProps = {
  description: string;
  imageUrl: string;
  modelId: string;
  name: string;
  onDescriptionChange: (value: string) => void;
  onGenerateCoverImage: (options: CoverImageOptions) => void;
  onGenerateDescription: () => void;
  onGenerateStarters: () => void;
  onImageUrlChange: (url: string) => void;
  onModelChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onStarterAdd: () => void;
  onStarterInputChange: (value: string) => void;
  onStarterInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onStarterRemove: (index: number) => void;
  starterInput: string;
  starterInputRef: RefObject<HTMLInputElement | null>;
  starterPrompts: string[];
  isGeneratingCoverImage?: boolean;
  isGeneratingDescription?: boolean;
  isGeneratingStarters?: boolean;
};

async function uploadAgentCover(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/agents/image', { method: 'POST', body: formData });
  const json = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Upload failed');
  return json.url ?? '';
}

export function AgentGeneralSection({
  description,
  imageUrl,
  isGeneratingCoverImage = false,
  isGeneratingDescription = false,
  isGeneratingStarters = false,
  modelId,
  name,
  onDescriptionChange,
  onGenerateCoverImage,
  onGenerateDescription,
  onGenerateStarters,
  onImageUrlChange,
  onModelChange,
  onNameChange,
  onStarterAdd,
  onStarterInputChange,
  onStarterInputKeyDown,
  onStarterRemove,
  starterInput,
  starterInputRef,
  starterPrompts,
}: AgentGeneralSectionProps) {
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverInstruction, setCoverInstruction] = useState('');
  const [coverModelId, setCoverModelId] = useState('nano-banana-2');
  const [coverAspectRatio, setCoverAspectRatio] = useState('1:1');

  const handleOpenCoverDialog = () => {
    setCoverDialogOpen(true);
  };

  const handleGenerateCoverSubmit = () => {
    onGenerateCoverImage({
      instruction: coverInstruction.trim() || undefined,
      modelId: coverModelId,
      aspectRatio: coverAspectRatio,
    });
    setCoverDialogOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Image upload */}
      <div className="flex items-center justify-end">
        <AiAssistButton
          onClick={handleOpenCoverDialog}
          isLoading={isGeneratingCoverImage}
          idleLabel="Generate cover"
          loadingLabel="Generating cover..."
          icon={<WandSparklesIcon className="size-3.5" />}
        />
      </div>
      <ImageUploadZone
        label="Cover image"
        value={imageUrl}
        onChange={onImageUrlChange}
        onUpload={uploadAgentCover}
      />

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="agent-name">Name *</Label>
        <Input
          id="agent-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Code Helper"
          maxLength={100}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="agent-description">Description</Label>
          <AiAssistButton
            onClick={onGenerateDescription}
            isLoading={isGeneratingDescription}
            idleLabel="Write with AI"
            loadingLabel="Writing..."
          />
        </div>
        <Input
          id="agent-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="What does this agent do?"
          maxLength={200}
        />
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <Label>Preferred Model</Label>
        <Select key={modelId} value={modelId} onValueChange={onModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Auto (recommended)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (recommended)</SelectItem>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Auto works best for most agents. Only change this if you need a specific capability.
        </p>
      </div>

      {/* Conversation starters */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>
            Conversation starters <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <AiAssistButton
            onClick={onGenerateStarters}
            isLoading={isGeneratingStarters}
            idleLabel="Suggest with AI"
            loadingLabel="Generating..."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Suggested prompts shown to users before their first message. Up to 4.
        </p>
        {starterPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {starterPrompts.map((starterPrompt, index) => (
              <span
                key={`${starterPrompt}-${index}`}
                className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/40 px-2.5 py-1 text-xs"
              >
                {starterPrompt}
                <button
                  type="button"
                  className="ml-0.5 text-muted-foreground transition hover:text-foreground"
                  onClick={() => onStarterRemove(index)}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {starterPrompts.length < 4 && (
          <div className="flex gap-2">
            <Input
              ref={starterInputRef}
              value={starterInput}
              onChange={(event) => onStarterInputChange(event.target.value)}
              onKeyDown={onStarterInputKeyDown}
              placeholder="e.g. What can you help me with?"
              maxLength={100}
              className="text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={!starterInput.trim()}
              onClick={onStarterAdd}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <AiImageAssistDialog
        open={coverDialogOpen}
        onOpenChange={setCoverDialogOpen}
        title="Generate Cover Image"
        description="Add optional visual direction before generating the agent cover."
        instruction={coverInstruction}
        onInstructionChange={setCoverInstruction}
        modelId={coverModelId}
        onModelIdChange={setCoverModelId}
        aspectRatio={coverAspectRatio}
        onAspectRatioChange={setCoverAspectRatio}
        onGenerate={handleGenerateCoverSubmit}
        isGenerating={isGeneratingCoverImage}
      />
    </div>
  );
}
