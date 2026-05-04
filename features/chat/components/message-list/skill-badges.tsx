'use client';

import { ZapIcon } from 'lucide-react';
import type { ActivatedSkillBadge } from '@/features/chat/types';

export function SkillBadges({ skills }: { skills: ActivatedSkillBadge[] }) {
  if (skills.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
          title={skill.source === 'model' ? 'Auto-discovered by AI' : 'Activated by trigger'}
        >
          <ZapIcon className="size-3 shrink-0" />
          {skill.name}
          {skill.source === 'model' && (
            <span className="opacity-60">(auto)</span>
          )}
        </span>
      ))}
    </div>
  );
}
