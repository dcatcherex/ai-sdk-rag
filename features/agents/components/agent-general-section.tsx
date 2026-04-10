'use client';

import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { ImageIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react';
import { availableModels } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AgentGeneralSectionProps = {
  description: string;
  imageUrl: string;
  modelId: string;
  name: string;
  onDescriptionChange: (value: string) => void;
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
};

export function AgentGeneralSection({
  description,
  imageUrl,
  modelId,
  name,
  onDescriptionChange,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/agents/image', { method: 'POST', body: formData });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
        return;
      }
      onImageUrlChange(json.url ?? '');
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Image upload */}
      <div className="space-y-1.5">
        <Label>Cover image <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative size-20 shrink-0 rounded-xl border-2 border-dashed border-input bg-muted/30 hover:bg-muted/60 transition overflow-hidden flex items-center justify-center group"
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Agent cover" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="size-7 text-muted-foreground group-hover:text-foreground transition" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
              <UploadIcon className="size-5 text-white" />
            </div>
          </button>
          <div className="flex flex-col gap-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-fit"
            >
              {uploading ? 'Uploading…' : imageUrl ? 'Change image' : 'Upload image'}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit text-destructive hover:text-destructive"
                onClick={() => onImageUrlChange('')}
              >
                <XIcon className="size-3.5 mr-1" /> Remove
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · max 2 MB</p>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

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
        <Label htmlFor="agent-description">Description</Label>
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
        <Select value={modelId} onValueChange={onModelChange}>
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
        <Label>
          Conversation starters <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
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
    </div>
  );
}
