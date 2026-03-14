'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';

type Props = {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
};

export function ChipInput({ values, onChange, placeholder }: Props) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const val = raw.trim();
    if (val && !values.includes(val)) onChange([...values, val]);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 min-h-10 rounded-md border border-black/10 dark:border-border bg-transparent focus-within:ring-1 focus-within:ring-black/20 dark:focus-within:ring-white/20">
      {values.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-full bg-black/8 dark:bg-white/10 px-2.5 py-0.5 text-sm"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${v}`}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault();
            add(input);
          }
          if (e.key === 'Backspace' && !input && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={values.length === 0 ? placeholder : ''}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
