'use client';

import type { ReactNode } from 'react';
import type { AgentEditorSectionId } from './agent-editor-sections';
import { AgentSectionNav } from './agent-section-nav';
import { AGENT_EDITOR_SECTIONS } from './agent-editor-sections';

type AgentSettingsLayoutProps = {
  activeSection: AgentEditorSectionId;
  children: ReactNode;
  onSectionChange: (section: AgentEditorSectionId) => void;
  sectionDescription?: string;
  sectionTitle?: string;
};

export function AgentSettingsLayout({
  activeSection,
  children,
  onSectionChange,
  sectionDescription,
  sectionTitle,
}: AgentSettingsLayoutProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-h-0 lg:overflow-y-auto">
        <AgentSectionNav
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          sections={AGENT_EDITOR_SECTIONS}
        />
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden bg-background">
        <div className="shrink-0 border-b border-black/5 px-2 pb-5 pt-3 dark:border-border sm:px-4 lg:px-6">
          <h3 className="text-xl font-semibold tracking-tight">{sectionTitle}</h3>
          {sectionDescription && <p className="mt-1 text-sm text-muted-foreground">{sectionDescription}</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-5 sm:px-4 lg:px-6">{children}</div>
      </div>
    </div>
  );
}
