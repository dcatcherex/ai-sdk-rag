'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  AgentSkillAttachmentInput,
  Skill,
  SkillActivationMode,
  SkillTriggerType,
} from '@/features/skills/types';
import { SKILL_CATEGORY_LABELS } from '@/features/skills/categories';
import { SelectionList } from './selection-list';
import { SelectionListToolbar, type SelectionFilterMode } from './selection-list-toolbar';

type AgentSkillsSectionProps = {
  skillIds: string[];
  skillAttachments: AgentSkillAttachmentInput[];
  userSkills: Skill[];
  onSkillToggle: (skillId: string, checked: boolean) => void;
  onSkillAttachmentChange: (
    skillId: string,
    field: 'activationModeOverride' | 'triggerTypeOverride' | 'triggerOverride' | 'priority',
    value: SkillActivationMode | SkillTriggerType | string | number | null,
  ) => void;
};

export function AgentSkillsSection({
  skillIds,
  skillAttachments,
  userSkills,
  onSkillToggle,
  onSkillAttachmentChange,
}: AgentSkillsSectionProps) {
  const [expandedSkillIds, setExpandedSkillIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<SelectionFilterMode>('all');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const skillPresets = [
    { id: 'brand-writing', label: 'Brand & Writing', categories: ['brand', 'writing'] },
    { id: 'support-core', label: 'Support Core', categories: ['support', 'operations'] },
    { id: 'sales-outreach', label: 'Sales & Outreach', categories: ['sales', 'marketing'] },
    { id: 'research-localization', label: 'Research & Localization', categories: ['research', 'localization'] },
  ] as const;

  const applyPreset = (applyMode: 'add' | 'replace') => {
    const preset = skillPresets.find((entry) => entry.id === selectedPresetId);
    if (!preset) return;

    const presetSkillIds = userSkills
      .filter((skill) => (preset.categories as readonly string[]).includes(skill.category ?? ''))
      .map((skill) => skill.id);
    const currentEnabled = new Set(skillIds);
    const nextEnabled = applyMode === 'replace' ? new Set<string>() : new Set(currentEnabled);

    for (const skillId of presetSkillIds) {
      nextEnabled.add(skillId);
    }

    for (const skillId of skillIds) {
      if (!nextEnabled.has(skillId)) {
        onSkillToggle(skillId, true);
      }
    }

    for (const skillId of presetSkillIds) {
      if (!currentEnabled.has(skillId)) {
        onSkillToggle(skillId, false);
      }
    }
  };

  const sections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredItems = userSkills
      .map((skill) => {
        const checked = skillIds.includes(skill.id);
        const attachment = skillAttachments.find((item) => item.skillId === skill.id);
        const expanded = expandedSkillIds[skill.id] ?? false;
        const triggerLabel =
          skill.triggerType === 'always' ? 'always' : skill.trigger ? skill.trigger : skill.triggerType;

        return {
          id: `skill-${skill.id}`,
          title: skill.name,
          meta: `· ${triggerLabel}`,
          checked,
          onToggle: () => onSkillToggle(skill.id, checked),
          action: checked ? (
            <button
              type="button"
              onClick={() => setExpandedSkillIds((current) => ({ ...current, [skill.id]: !expanded }))}
              className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
              title={expanded ? 'Hide options' : 'Show options'}
            >
              {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            </button>
          ) : undefined,
          expandedContent: checked && expanded && attachment ? (
            <div className="grid gap-2 rounded-md border border-black/5 bg-background/80 p-2 dark:border-border sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Activation override</Label>
                <Select
                  value={attachment.activationModeOverride ?? 'inherit'}
                  onValueChange={(value) =>
                    onSkillAttachmentChange(
                      skill.id,
                      'activationModeOverride',
                      value === 'inherit' ? null : (value as SkillActivationMode),
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit skill default</SelectItem>
                    <SelectItem value="rule">Rule-based</SelectItem>
                    <SelectItem value="model">Model discovered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Trigger type override</Label>
                <Select
                  value={attachment.triggerTypeOverride ?? 'inherit'}
                  onValueChange={(value) =>
                    onSkillAttachmentChange(
                      skill.id,
                      'triggerTypeOverride',
                      value === 'inherit' ? null : (value as SkillTriggerType),
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit skill default</SelectItem>
                    <SelectItem value="always">Always active</SelectItem>
                    <SelectItem value="slash">Slash command</SelectItem>
                    <SelectItem value="keyword">Keyword match</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Trigger override</Label>
                <Input
                  value={attachment.triggerOverride ?? ''}
                  onChange={(event) => onSkillAttachmentChange(skill.id, 'triggerOverride', event.target.value || null)}
                  placeholder={skill.trigger ?? 'Override trigger'}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Priority</Label>
                <Input
                  type="number"
                  min={0}
                  value={attachment.priority ?? 0}
                  onChange={(event) => onSkillAttachmentChange(skill.id, 'priority', Number(event.target.value || 0))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : undefined,
        };
      })
      .filter((item) => {
        if (mode === 'selected' && !item.checked) return false;
        if (!normalizedSearch) return true;
        return `${item.title} ${item.meta ?? ''}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => Number(b.checked) - Number(a.checked) || a.title.localeCompare(b.title));

    const categoryOrder = [
      'brand',
      'writing',
      'support',
      'sales',
      'research',
      'localization',
      'operations',
      'education',
      'marketing',
      'uncategorized',
    ];

    return categoryOrder.map((category) => ({
      id: category,
      label: SKILL_CATEGORY_LABELS[category] ?? category,
      items: filteredItems.filter((item) => {
        const skill = userSkills.find((entry) => `skill-${entry.id}` === item.id);
        const skillCategory = skill?.category ?? 'uncategorized';
        return skillCategory === category;
      }),
    }));
  }, [
    expandedSkillIds,
    mode,
    onSkillAttachmentChange,
    onSkillToggle,
    search,
    skillAttachments,
    skillIds,
    userSkills,
  ]);

  return (
    <div className="space-y-2">
      <SelectionListToolbar
        mode={mode}
        onModeChange={setMode}
        onPresetApply={applyPreset}
        onPresetChange={setSelectedPresetId}
        onSearchChange={setSearch}
        presets={skillPresets.map(({ id, label }) => ({ id, label }))}
        searchPlaceholder="Search skills..."
        selectedPresetId={selectedPresetId}
        searchValue={search}
      />
      <SelectionList
        emptyMessage="No skills yet. Create skills in the Skills section."
        sections={sections}
      />
      {skillIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {skillIds.length} skill{skillIds.length !== 1 ? 's' : ''} attached
        </p>
      ) : null}
    </div>
  );
}
