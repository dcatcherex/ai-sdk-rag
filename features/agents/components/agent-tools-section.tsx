'use client';

import { useMemo, useState } from 'react';
import { TOOL_GROUP_LABELS, TOOL_REGISTRY, type ToolGroup } from '@/lib/tool-registry';
import { SelectionList } from './selection-list';
import { SelectionListToolbar, type SelectionFilterMode } from './selection-list-toolbar';

type AgentToolsSectionProps = {
  enabledTools: string[];
  onToggleTool: (toolId: string) => void;
};

export function AgentToolsSection({ enabledTools, onToggleTool }: AgentToolsSectionProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<SelectionFilterMode>('all');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const toolPresets = [
    { id: 'research', label: 'Research Starter', toolIds: ['knowledge_base', 'weather', 'google_docs', 'google_drive', 'google_sheets'] },
    { id: 'marketing', label: 'Marketing Starter', toolIds: ['content_marketing', 'image', 'video', 'long_form', 'distribution', 'repurposing'] },
    { id: 'education', label: 'Education Starter', toolIds: ['exam_prep', 'exam_builder', 'certificate'] },
  ] as const;

  const applyPreset = (applyMode: 'add' | 'replace') => {
    const preset = toolPresets.find((entry) => entry.id === selectedPresetId);
    if (!preset) return;

    const currentEnabled = new Set(enabledTools);
    const nextEnabled = applyMode === 'replace' ? new Set<string>() : new Set(currentEnabled);

    for (const toolId of preset.toolIds) {
      nextEnabled.add(toolId);
    }

    for (const toolId of enabledTools) {
      if (!nextEnabled.has(toolId)) {
        onToggleTool(toolId);
      }
    }

    for (const toolId of preset.toolIds) {
      if (!currentEnabled.has(toolId)) {
        onToggleTool(toolId);
      }
    }
  };

  const sections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredItems = Object.entries(TOOL_REGISTRY)
      .map(([id, meta]) => ({
        id: `tool-${id}`,
        group: meta.group,
        title: meta.label,
        checked: enabledTools.includes(id),
        onToggle: () => onToggleTool(id),
      }))
      .filter((item) => {
        if (mode === 'selected' && !item.checked) return false;
        if (!normalizedSearch) return true;
        return item.title.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => Number(b.checked) - Number(a.checked) || a.title.localeCompare(b.title));

    const groups: ToolGroup[] = ['knowledge', 'productivity', 'utilities'];
    return groups.map((group) => ({
      id: group,
      label: TOOL_GROUP_LABELS[group],
      items: filteredItems.filter((item) => item.group === group),
    }));
  }, [enabledTools, mode, onToggleTool, search]);

  return (
    <div className="space-y-2">
      <SelectionListToolbar
        mode={mode}
        onModeChange={setMode}
        onPresetApply={applyPreset}
        onPresetChange={setSelectedPresetId}
        onSearchChange={setSearch}
        presets={toolPresets.map(({ id, label }) => ({ id, label }))}
        searchPlaceholder="Search tools..."
        selectedPresetId={selectedPresetId}
        searchValue={search}
      />
      <SelectionList
        emptyMessage="No tools available."
        sections={sections}
      />
    </div>
  );
}
