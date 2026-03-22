'use client';

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
        <Label htmlFor="prompt">Prompt</Label>
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
