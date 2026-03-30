'use client';

import type { KeyboardEvent, RefObject } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AgentGeneralSectionProps = {
  description: string;
  name: string;
  onDescriptionChange: (value: string) => void;
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
  name,
  onDescriptionChange,
  onNameChange,
  onStarterAdd,
  onStarterInputChange,
  onStarterInputKeyDown,
  onStarterRemove,
  starterInput,
  starterInputRef,
  starterPrompts,
}: AgentGeneralSectionProps) {
  return (
    <div className="space-y-5">
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
