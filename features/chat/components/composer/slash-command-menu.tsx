'use client';

import { useCallback, useEffect, useState } from 'react';
import { ZapIcon } from 'lucide-react';
import { usePromptInputController } from '@/components/ai-elements/prompt-input';
import type { SkillWithOwner } from '@/features/skills/types';

function getSlashQuery(input: string): string | null {
  const match = input.match(/(?:^|[\s฀-๿])\/([\S]*)$/);
  if (!match) return null;
  return match[1]!.toLowerCase();
}

type SlashCommandMenuProps = {
  skills: SkillWithOwner[];
  onSelect: (skill: SkillWithOwner) => void;
};

/** Floating command list — appears while the user is typing a /command */
export const SlashCommandMenu = ({ skills, onSelect }: SlashCommandMenuProps) => {
  const controller = usePromptInputController();
  const input = controller.textInput.value;
  const [activeIndex, setActiveIndex] = useState(0);

  const query = getSlashQuery(input);
  const slashSkills = skills.filter((s) => s.triggerType === 'slash' && s.trigger);
  const filtered = query === null ? [] : slashSkills.filter((s) => {
    const t = (s.trigger!.startsWith('/') ? s.trigger!.slice(1) : s.trigger!).toLowerCase();
    return t.startsWith(query);
  });
  const isOpen = query !== null;

  useEffect(() => { setActiveIndex(0); }, [filtered.length]);

  const select = useCallback((skill: SkillWithOwner) => { onSelect(skill); }, [onSelect]);

  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); select(filtered[activeIndex]!); }
      else if (e.key === 'Escape') { e.preventDefault(); controller.textInput.setInput(''); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, filtered, activeIndex, select, controller]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-black/8 bg-white/95 shadow-lg backdrop-blur dark:border-white/12 dark:bg-zinc-900/95">
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          No slash commands found. Add a slash trigger to a skill to use it here.
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.map((skill, i) => {
            const sourceTag = skill.userId === null ? 'System' : skill.isPublic ? 'Team' : 'Personal';
            return (
              <button
                key={skill.id}
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === activeIndex ? 'bg-primary/8' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(skill)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <ZapIcon className="size-3 text-primary" />
                </span>
                <span className="min-w-0 flex-1 flex items-baseline gap-2 overflow-hidden">
                  <span className="shrink-0 text-sm font-medium text-foreground">{skill.name}</span>
                  {skill.description && (
                    <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/60">{sourceTag}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
