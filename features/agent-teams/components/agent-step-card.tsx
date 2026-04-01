'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamRunStatusUpdate, ArtifactType } from '../types';

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  research_brief: 'Research',
  ad_copy: 'Ad Copy',
  analysis: 'Analysis',
  creative_direction: 'Creative',
  strategy: 'Strategy',
  content: 'Content',
  other: 'Output',
};

const ARTIFACT_COLORS: Record<ArtifactType, string> = {
  research_brief: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  ad_copy: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  analysis: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  creative_direction: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  strategy: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  content: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  other: 'bg-muted text-muted-foreground',
};

type CompletedStep = Extract<TeamRunStatusUpdate, { type: 'step_complete' }>;

type AgentStepCardProps = {
  step: CompletedStep;
  stepNumber: number;
};

export function AgentStepCard({ step, stepNumber }: AgentStepCardProps) {
  const [open, setOpen] = useState(false);
  const label = ARTIFACT_LABELS[step.artifactType];
  const colorClass = ARTIFACT_COLORS[step.artifactType];

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {/* Step number */}
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {stepNumber}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {step.displayRole ?? step.agentName}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                colorClass,
              )}
            >
              {label}
            </span>
          </div>
          {!open && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{step.summary}</p>
          )}
        </div>

        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {step.summary}
          </p>
        </div>
      )}
    </div>
  );
}
