'use client';

import type { ReactNode } from 'react';
import { SettingsShell } from '@/components/settings-shell';
import type { AgentEditorSectionId } from './agent-editor-sections';
import { AGENT_EDITOR_SECTIONS } from './agent-editor-sections';

type AgentSettingsLayoutProps = {
  activeSection: AgentEditorSectionId;
  children: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  onSectionChange: (section: AgentEditorSectionId) => void;
  sectionDescription?: string;
  sectionTitle?: string;
};

export function AgentSettingsLayout({
  activeSection,
  children,
  footer,
  footerClassName,
  onSectionChange,
  sectionDescription,
  sectionTitle,
}: AgentSettingsLayoutProps) {
  return (
    <SettingsShell
      activeItem={activeSection}
      items={AGENT_EDITOR_SECTIONS}
      onItemChange={onSectionChange}
      sectionTitle={sectionTitle ?? 'General'}
      sectionDescription={sectionDescription}
      sidebarLabel="Settings"
      footer={footer}
      footerClassName={footerClassName}
    >
      {children}
    </SettingsShell>
  );
}
