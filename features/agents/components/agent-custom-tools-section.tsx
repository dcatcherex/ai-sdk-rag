'use client';

import { useMemo, useState } from 'react';
import type { AgentUserToolAttachmentInput } from '@/features/user-tools/types';
import type { UserToolListItem } from '@/features/user-tools/hooks/use-user-tools';
import { SelectionList } from './selection-list';
import { SelectionListToolbar, type SelectionFilterMode } from './selection-list-toolbar';

type AgentCustomToolsSectionProps = {
  attachments: AgentUserToolAttachmentInput[];
  userTools: UserToolListItem[];
  onToolToggle: (toolId: string, currentlySelected: boolean) => void;
};

export function AgentCustomToolsSection({
  attachments,
  userTools,
  onToolToggle,
}: AgentCustomToolsSectionProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<SelectionFilterMode>('all');

  const selectedToolIds = new Set(attachments.map((item) => item.userToolId));

  const sections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredItems = userTools
      .filter((tool) => tool.supportsAgent)
      .map((tool) => ({
        id: `custom-tool-${tool.id}`,
        group: tool.category || 'utilities',
        title: tool.name,
        meta: `- ${tool.executionType} - ${tool.status}`,
        checked: selectedToolIds.has(tool.id),
        onToggle: () => onToolToggle(tool.id, selectedToolIds.has(tool.id)),
      }))
      .filter((item) => {
        if (mode === 'selected' && !item.checked) return false;
        if (!normalizedSearch) return true;
        return `${item.title} ${item.meta ?? ''}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => Number(b.checked) - Number(a.checked) || a.title.localeCompare(b.title));

    const groups = [...new Set(filteredItems.map((item) => item.group))];
    return groups.map((group) => ({
      id: group,
      label: group,
      items: filteredItems.filter((item) => item.group === group),
    }));
  }, [mode, onToolToggle, search, selectedToolIds, userTools]);

  return (
    <div className="space-y-2">
      <SelectionListToolbar
        mode={mode}
        onModeChange={setMode}
        onPresetApply={() => undefined}
        onPresetChange={() => undefined}
        onSearchChange={setSearch}
        presets={[]}
        searchPlaceholder="Search custom tools..."
        selectedPresetId=""
        searchValue={search}
      />
      <SelectionList
        emptyMessage="No agent-ready user tools yet. Create one in User Tools and enable agent support."
        sections={sections}
      />
      {attachments.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {attachments.length} custom tool{attachments.length !== 1 ? 's' : ''} attached
        </p>
      ) : null}
    </div>
  );
}
