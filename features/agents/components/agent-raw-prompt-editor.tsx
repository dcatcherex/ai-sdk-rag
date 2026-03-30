'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AgentRawPromptEditorProps = {
  estimatedTokens: number;
  generatedPrompt: string;
  isCustomized: boolean;
  isPanel: boolean;
  onResetFromStructured: () => void;
  onSystemPromptChange: (value: string) => void;
  systemPrompt: string;
  systemPromptChars: number;
  systemPromptLines: number;
};

export function AgentRawPromptEditor({
  estimatedTokens,
  generatedPrompt,
  isCustomized,
  isPanel,
  onResetFromStructured,
  onSystemPromptChange,
  systemPrompt,
  systemPromptChars,
  systemPromptLines,
}: AgentRawPromptEditorProps) {
  return (
    <div className="space-y-5">
      {isCustomized && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          This prompt has custom raw edits and may no longer match the structured behavior settings.
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="agent-prompt">System Prompt *</Label>
          <div className="text-xs text-muted-foreground">
            {systemPromptChars} chars
            {' · '}
            ~{estimatedTokens} tokens
            {' · '}
            {systemPromptLines} lines
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Advanced mode lets you edit the final system prompt directly.
        </p>
        <Textarea
          id="agent-prompt"
          value={systemPrompt}
          onChange={(event) => onSystemPromptChange(event.target.value)}
          placeholder="You are an expert..."
          className={cn(
            'w-full',
            isPanel ? 'min-h-[420px] resize-y font-mono text-sm leading-6' : 'min-h-28 resize-none'
          )}
          required
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-muted/20 p-3 dark:border-border">
        <div>
          <p className="text-sm font-medium">Reset from Structured</p>
          <p className="text-xs text-muted-foreground">
            Replace the raw prompt with the latest structured behavior output.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onResetFromStructured} disabled={!generatedPrompt.trim()}>
          Reset
        </Button>
      </div>
    </div>
  );
}
