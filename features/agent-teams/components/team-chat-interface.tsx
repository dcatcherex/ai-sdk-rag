'use client';

import { useState, useRef, useEffect } from 'react';
import { SendIcon, RotateCcwIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeamActivityFeed } from './team-activity-feed';
import { useTeamChat } from '../hooks/use-team-chat';

type TeamChatInterfaceProps = {
  teamId: string;
  teamName: string;
  threadId?: string | null;
};

export function TeamChatInterface({ teamId, teamName, threadId }: TeamChatInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const { status, teamUpdates, output, error, run, reset } = useTeamChat(teamId, threadId);
  const outputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll output into view as it streams
  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [output]);

  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isError = status === 'error';
  const hasResult = isDone || isError;

  function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    setPrompt('');
    void run(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleReset() {
    reset();
    setPrompt('');
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Activity feed — visible once the run starts */}
      {(teamUpdates.length > 0 || isRunning) && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agent steps
          </p>
          <TeamActivityFeed updates={teamUpdates} status={status} />
        </div>
      )}

      {/* Final synthesized output */}
      {(output || (isDone && teamUpdates.length > 0)) && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Final output
          </p>
          <ScrollArea className="max-h-[480px]">
            <div
              ref={outputRef}
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed"
            >
              {output}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Error state */}
      {isError && error && !teamUpdates.some((u) => u.type === 'run_error') && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Prompt input */}
      <div className="rounded-lg border bg-card p-3">
        {hasResult && (
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Run another prompt with {teamName}
            </p>
            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={handleReset}>
              <RotateCcwIcon className="size-3" />
              Clear
            </Button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder={`Ask the ${teamName} team anything…`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none text-sm"
            disabled={isRunning}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isRunning}
          >
            {isRunning ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
