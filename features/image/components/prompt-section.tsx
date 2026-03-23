'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PromptBuilder } from '../ui/prompt-builder';
import type { Mode } from '../hooks/use-image-generator';

const PLACEHOLDER: Record<Mode, string> = {
  generate: 'A stoic robot barista with glowing blue optics, brewing coffee in a futuristic café on Mars, photorealistic style…',
  edit: "Change the sofa's color to deep navy blue. Keep everything else identical.",
};

interface Props {
  mode: Mode;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function PromptSection({ mode, value, onChange, disabled }: Props) {
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="prompt">Prompt</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-default" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-64 space-y-1.5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt Tips</p>
                <ul className="text-xs space-y-1">
                  <li>• <strong>Subject:</strong> Be specific about who or what is in the image</li>
                  <li>• <strong>Style:</strong> Add "photorealistic", "watercolor", "3D animation"</li>
                  <li>• <strong>Composition:</strong> "wide shot", "close-up", "portrait"</li>
                  <li>• <strong>Editing:</strong> Use direct commands — "Change the tie to green"</li>
                  <li>• Use the <Sparkles className="inline h-3 w-3" /> Prompt builder for guided input</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={() => setBuilderOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Prompt builder
          {builderOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      <Textarea
        id="prompt"
        placeholder={PLACEHOLDER[mode]}
        rows={4}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
      {builderOpen && (
        <PromptBuilder mode={mode} onApply={p => { onChange(p); setBuilderOpen(false); }} />
      )}
    </div>
  );
}
