'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  SendIcon,
  RotateCcwIcon,
  LoaderIcon,
  MessageSquareIcon,
  AlertTriangleIcon,
  CheckIcon,
  PlayIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeamActivityFeed } from './team-activity-feed';
import { ContractOutputRenderer } from './contract-output-renderer';
import { useTeamChat } from '../hooks/use-team-chat';
import { useThreadList } from '../hooks/use-thread-list';
import { setPendingThread } from '@/features/chat/hooks/use-threads';
import type { AgentTeamConfig, RoutingStrategy } from '../types';

type TeamChatInterfaceProps = {
  teamId: string;
  teamName: string;
  routingStrategy?: RoutingStrategy;
  outputContract?: AgentTeamConfig['outputContract'];
  contractSections?: string[];
  /** Pre-selected thread from parent (e.g. if navigated from chat) */
  threadId?: string | null;
};

export function TeamChatInterface({
  teamId,
  teamName,
  routingStrategy = 'sequential',
  outputContract,
  contractSections,
  threadId: initialThreadId,
}: TeamChatInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId ?? null);

  const { data: threads } = useThreadList();
  const {
    status,
    teamUpdates,
    output,
    error,
    planSteps,
    planFallback,
    editedSubPrompts,
    setEditedSubPrompt,
    fetchPlan,
    approvePlan,
    run,
    reset,
  } = useTeamChat(teamId, routingStrategy, selectedThreadId);

  const outputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [output]);

  const isRunning = status === 'running';
  const isAwaitingApproval = status === 'awaiting_approval';
  const isDone = status === 'done';
  const isError = status === 'error';
  const hasResult = isDone || isError;
  const isBlocked = isRunning || isAwaitingApproval;

  function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed || isBlocked) return;
    setPrompt('');
    if (routingStrategy === 'planner_generated') {
      void fetchPlan(trimmed);
    } else {
      void run(trimmed);
    }
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
      {/* ── Plan preview (awaiting_approval) ─────────────────────────────── */}
      {isAwaitingApproval && planSteps.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Review execution plan</p>
            {planFallback && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-3.5" />
                Planner could not generate a structured plan — using sequential fallback
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Review each step&apos;s sub-prompt before committing credits. Edit any prompt to steer the specialist.
          </p>

          <div className="space-y-2">
            {planSteps.map((step, idx) => (
              <div key={step.memberId} className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium">{step.memberName}</span>
                  {step.displayRole && (
                    <Badge variant="secondary" className="text-[11px]">
                      {step.displayRole}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[11px] ml-auto">
                    {step.artifactType.replace('_', ' ')}
                  </Badge>
                </div>
                <Textarea
                  value={editedSubPrompts[step.memberId] ?? step.subPrompt}
                  onChange={(e) => setEditedSubPrompt(step.memberId, e.target.value)}
                  rows={2}
                  className="resize-none text-xs"
                />
                {step.reasoning && (
                  <p className="text-[11px] text-muted-foreground italic">{step.reasoning}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => void approvePlan()}>
              <PlayIcon className="size-3.5" />
              Run with this plan
            </Button>
          </div>
        </div>
      )}

      {/* Activity feed */}
      {(teamUpdates.length > 0 || isRunning) && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Agent steps
          </p>
          <TeamActivityFeed updates={teamUpdates} status={status} />
        </div>
      )}

      {/* Final output */}
      {output && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Final output
            </p>
            {isDone && selectedThreadId && (
              <Link
                href="/"
                onClick={() => setPendingThread(selectedThreadId)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <MessageSquareIcon className="size-3" />
                View in chat
              </Link>
            )}
          </div>
          <ScrollArea className="max-h-[480px]">
            <div ref={outputRef}>
              <ContractOutputRenderer
                output={output}
                outputContract={outputContract}
                contractSections={contractSections}
              />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Saved-to-thread notice */}
      {isDone && selectedThreadId && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5 shrink-0 text-primary" />
          Output saved to thread.{' '}
          <Link
            href="/"
            onClick={() => setPendingThread(selectedThreadId)}
            className="text-primary hover:underline font-medium"
          >
            Open in chat →
          </Link>
        </div>
      )}

      {/* Error */}
      {isError && error && !teamUpdates.some((u) => u.type === 'run_error') && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Prompt input (hide while awaiting plan approval) */}
      {!isAwaitingApproval && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {hasResult && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Run another prompt with {teamName}
              </p>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={handleReset}>
                <RotateCcwIcon className="size-3" />
                Clear
              </Button>
            </div>
          )}

          {/* Thread selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Save to thread:</span>
            <Select
              value={selectedThreadId ?? '__none__'}
              onValueChange={(v) => setSelectedThreadId(v === '__none__' ? null : v)}
              disabled={isBlocked}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="None (run only)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (run only)</SelectItem>
                {threads?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              placeholder={`Ask the ${teamName} team anything…`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none text-sm"
              disabled={isBlocked}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isBlocked}
            >
              {isRunning ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
            {routingStrategy === 'planner_generated' && ' · Planner will preview steps before running'}
            {selectedThreadId && ' · Output will be appended to the selected thread'}
          </p>
        </div>
      )}
    </div>
  );
}
