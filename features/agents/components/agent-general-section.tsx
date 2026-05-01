'use client';

import { useState } from 'react';
import { WandSparklesIcon } from 'lucide-react';
import { AiAssistButton } from '@/features/workspace-ai/components/ai-assist-button';
import { AiImageAssistDialog } from '@/features/workspace-ai/components/ai-image-assist-dialog';
import { availableModels } from '@/lib/ai';
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
import type { AgentStarterTask } from '@/features/chat/components/empty-state/types';
import { AgentStarterTasksSection } from './agent-starter-tasks-section';

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
  onStarterTaskAdd: () => void;
  onStarterTaskChange: <K extends keyof AgentStarterTask>(id: string, field: K, value: AgentStarterTask[K]) => void;
  onStarterTaskRemove: (id: string) => void;
  starterTasks?: AgentStarterTask[];
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
  onStarterTaskAdd,
  onStarterTaskChange,
  onStarterTaskRemove,
  starterTasks = [],
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

      {/* Starter tasks */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>
            Starter tasks <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <AiAssistButton
            onClick={onGenerateStarters}
            isLoading={isGeneratingStarters}
            idleLabel="Suggest with AI"
            loadingLabel="Generating..."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Curated actions shown before the first message. Add up to 4 primary and 6 secondary tasks.
        </p>
      </div>

      <AgentStarterTasksSection
        starterTasks={starterTasks}
        onAddTask={onStarterTaskAdd}
        onRemoveTask={onStarterTaskRemove}
        onTaskChange={onStarterTaskChange}
      />

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
