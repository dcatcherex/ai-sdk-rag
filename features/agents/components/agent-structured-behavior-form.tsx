'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AgentStructuredBehaviorFormProps = {
  contextValue: string;
  exampleRepliesValue: string;
  generatedPrompt: string;
  keyInstructionsValue: string[];
  languageEnglish: boolean;
  languageMobileFriendly: boolean;
  languageThai: boolean;
  onContextChange: (value: string) => void;
  onExampleRepliesChange: (value: string) => void;
  onKeyInstructionAdd: () => void;
  onKeyInstructionChange: (index: number, value: string) => void;
  onKeyInstructionInputChange: (value: string) => void;
  onKeyInstructionRemove: (index: number) => void;
  onLanguageEnglishChange: (value: boolean) => void;
  onLanguageMobileFriendlyChange: (value: boolean) => void;
  onLanguageThaiChange: (value: boolean) => void;
  onRoleChange: (value: string) => void;
  onToneToggle: (tone: string) => void;
  onUseGeneratedPrompt: () => void;
  roleValue: string;
  selectedTones: string[];
  toneOptions: string[];
  workingInstructionValue: string;
};

export function AgentStructuredBehaviorForm({
  contextValue,
  exampleRepliesValue,
  generatedPrompt,
  keyInstructionsValue,
  languageEnglish,
  languageMobileFriendly,
  languageThai,
  onContextChange,
  onExampleRepliesChange,
  onKeyInstructionAdd,
  onKeyInstructionChange,
  onKeyInstructionInputChange,
  onKeyInstructionRemove,
  onLanguageEnglishChange,
  onLanguageMobileFriendlyChange,
  onLanguageThaiChange,
  onRoleChange,
  onToneToggle,
  onUseGeneratedPrompt,
  roleValue,
  selectedTones,
  toneOptions,
  workingInstructionValue,
}: AgentStructuredBehaviorFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="agent-behavior-role">Role</Label>
        <Textarea
          id="agent-behavior-role"
          value={roleValue}
          onChange={(event) => onRoleChange(event.target.value)}
          placeholder="Describe what this assistant should do for users."
          className="min-h-24 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label>Tone & Style</Label>
        <div className="flex flex-wrap gap-2">
          {toneOptions.map((tone) => {
            const selected = selectedTones.includes(tone);
            return (
              <Button
                key={tone}
                type="button"
                variant={selected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToneToggle(tone)}
              >
                {tone}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Language Rules</Label>
        <div className="space-y-2 rounded-lg border border-black/5 bg-muted/20 p-3 dark:border-border">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={languageThai}
              onChange={(event) => onLanguageThaiChange(event.target.checked)}
              className="size-4 rounded border accent-primary"
            />
            Reply in Thai when the user writes Thai
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={languageEnglish}
              onChange={(event) => onLanguageEnglishChange(event.target.checked)}
              className="size-4 rounded border accent-primary"
            />
            Reply in English when the user writes English
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={languageMobileFriendly}
              onChange={(event) => onLanguageMobileFriendlyChange(event.target.checked)}
              className="size-4 rounded border accent-primary"
            />
            Keep replies short and mobile-friendly
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Key Instructions</Label>
        {keyInstructionsValue.length > 0 && (
          <div className="space-y-2">
            {keyInstructionsValue.map((instruction, index) => (
              <div key={`${index}-${instruction}`} className="flex gap-2">
                <Input
                  value={instruction}
                  onChange={(event) => onKeyInstructionChange(index, event.target.value)}
                  placeholder="Instruction"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => onKeyInstructionRemove(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={workingInstructionValue}
            onChange={(event) => onKeyInstructionInputChange(event.target.value)}
            placeholder="Add another instruction"
          />
          <Button type="button" variant="outline" onClick={onKeyInstructionAdd} disabled={!workingInstructionValue.trim()}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-behavior-context">Program or Business Context</Label>
        <Textarea
          id="agent-behavior-context"
          value={contextValue}
          onChange={(event) => onContextChange(event.target.value)}
          placeholder="Add important business facts, program details, limitations, or policies."
          className="min-h-28 resize-y"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-behavior-examples">Example Replies</Label>
        <Textarea
          id="agent-behavior-examples"
          value={exampleRepliesValue}
          onChange={(event) => onExampleRepliesChange(event.target.value)}
          placeholder="Optional examples that show the desired style or phrasing."
          className="min-h-24 resize-y"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-black/5 bg-muted/20 p-4 dark:border-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Generated Prompt Preview</p>
            <p className="text-xs text-muted-foreground">
              Structured inputs generate the raw system prompt used for saving.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onUseGeneratedPrompt} disabled={!generatedPrompt.trim()}>
            Use generated prompt
          </Button>
        </div>
        <pre
          className={cn(
            'max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs leading-6 text-muted-foreground',
            !generatedPrompt.trim() && 'italic'
          )}
        >
          {generatedPrompt.trim() || 'Add structured behavior details to generate a prompt preview.'}
        </pre>
      </div>
    </div>
  );
}
