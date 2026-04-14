'use client';

import type { ReactNode } from 'react';
import { SettingsShell, type SettingsShellItem } from '@/components/settings-shell';

type AgentSettingsLayoutProps<T extends string> = {
  activeSection: T;
  children: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  items: SettingsShellItem<T>[];
  onSectionChange: (section: T) => void;
  sectionDescription?: string;
  sectionTitle?: string;
};

export function AgentSettingsLayout<T extends string>({
  activeSection,
  children,
  footer,
  footerClassName,
  items,
  onSectionChange,
  sectionDescription,
  sectionTitle,
}: AgentSettingsLayoutProps<T>) {
  return (
    <SettingsShell
      activeItem={activeSection}
      items={items}
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
