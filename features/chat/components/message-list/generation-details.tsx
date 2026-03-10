'use client';

import { useState } from 'react';
import { ChevronDownIcon, SparklesIcon } from 'lucide-react';
import type { ChatMessageMetadata } from '@/features/chat/types';

const PERSONA_LABELS: Record<string, string> = {
  general_assistant: 'General',
  coding_copilot: 'Coding',
  product_manager: 'Product',
  friendly_tutor: 'Tutor',
  data_analyst: 'Data Analysis',
  summarizer_editor: 'Summarizer',
  security_privacy_guard: 'Security',
  research_librarian: 'Research',
  translation_localization: 'Translation',
  troubleshooting_debugger: 'Debugger',
};

export const EnhancedPromptChip = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
      >
        <SparklesIcon className="size-3" />
        Enhanced
        <ChevronDownIcon className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="mt-1.5 rounded-lg border border-violet-100 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {text}
        </p>
      )}
    </div>
  );
};

export const GenerationDetails = ({ metadata }: { metadata: ChatMessageMetadata }) => {
  const [promptOpen, setPromptOpen] = useState(false);
  const { routing, persona, enhancedPrompt } = metadata;
  if (!routing) return null;

  return (
    <div className="mt-3 rounded-lg border border-black/6 dark:border-white/8 bg-black/2 dark:bg-white/3 px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Model</span>
          <span className="text-[11px] font-medium text-foreground">{routing.modelId.split('/')[1] ?? routing.modelId}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${routing.mode === 'manual' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
            {routing.mode === 'manual' ? 'Manual' : 'Auto'}
          </span>
        </div>
        {routing.mode === 'auto' && routing.reason && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Reason</span>
            <span className="text-[11px] text-muted-foreground">{routing.reason}</span>
          </div>
        )}
        {persona && persona !== 'general_assistant' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Persona</span>
            <span className="text-[11px] text-muted-foreground">{PERSONA_LABELS[persona] ?? persona}</span>
          </div>
        )}
      </div>
      {enhancedPrompt && (
        <div>
          <button
            type="button"
            onClick={() => setPromptOpen((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <SparklesIcon className="size-3" />
            Enhanced prompt
            <ChevronDownIcon className={`size-3 transition-transform ${promptOpen ? 'rotate-180' : ''}`} />
          </button>
          {promptOpen && (
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed border-l-2 border-black/10 dark:border-white/10 pl-2">
              {enhancedPrompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
