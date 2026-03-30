'use client';

import { cn } from '@/lib/utils';
import type { AgentEditorSection, AgentEditorSectionId } from './agent-editor-sections';

type AgentSectionNavProps = {
  activeSection: AgentEditorSectionId;
  onSectionChange: (section: AgentEditorSectionId) => void;
  sections: AgentEditorSection[];
};

export function AgentSectionNav({ activeSection, onSectionChange, sections }: AgentSectionNavProps) {
  return (
    <nav className="flex h-full flex-col border-r border-black/5 pr-5 dark:border-border">
      <div className="px-3 pb-3 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settings</p>
      </div>
      <div className="flex flex-col gap-1">
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          const Icon = section.icon;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                isActive
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <Icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="truncate">{section.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
