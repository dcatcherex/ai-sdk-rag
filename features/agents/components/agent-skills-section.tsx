'use client';

import { useState } from 'react';
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentSkillAttachmentInput, Skill, SkillActivationMode, SkillTriggerType } from '@/features/skills/types';

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

type SkillRowProps = {
  skill: Skill;
  checked: boolean;
  attachment: AgentSkillAttachmentInput | undefined;
  onToggle: () => void;
  onAttachmentChange: (
    field: 'activationModeOverride' | 'triggerTypeOverride' | 'triggerOverride' | 'priority',
    value: SkillActivationMode | SkillTriggerType | string | number | null,
  ) => void;
};

function SkillRow({ skill, checked, attachment, onToggle, onAttachmentChange }: SkillRowProps) {
  const [expanded, setExpanded] = useState(false);
  const triggerLabel =
    skill.triggerType === 'always' ? 'always' : skill.trigger ? `${skill.trigger}` : skill.triggerType;

  return (
    <div className="rounded px-2 py-1.5 hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`skill-${skill.id}`}
          checked={checked}
          onChange={onToggle}
          className="size-3.5 cursor-pointer rounded border accent-primary shrink-0"
        />
        <label
          htmlFor={`skill-${skill.id}`}
          className="flex flex-1 cursor-pointer items-center gap-1.5 text-xs font-medium leading-none min-w-0"
        >
          <SparklesIcon className="size-3 shrink-0 text-primary" />
          <span className="truncate">{skill.name}</span>
          <span className="font-normal text-muted-foreground shrink-0">· {triggerLabel}</span>
        </label>
        {checked && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition p-0.5 rounded"
            title={expanded ? 'Hide options' : 'Show options'}
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </button>
        )}
      </div>

      {checked && expanded && attachment && (
        <div className="mt-2 grid gap-2 rounded-md border border-black/5 bg-background/80 p-2 dark:border-border sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Activation override</Label>
            <Select
              value={attachment.activationModeOverride ?? 'inherit'}
              onValueChange={(value) => onAttachmentChange('activationModeOverride', value === 'inherit' ? null : value as SkillActivationMode)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
              onValueChange={(value) => onAttachmentChange('triggerTypeOverride', value === 'inherit' ? null : value as SkillTriggerType)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
              onChange={(e) => onAttachmentChange('triggerOverride', e.target.value || null)}
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
              onChange={(e) => onAttachmentChange('priority', Number(e.target.value || 0))}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentSkillsSection({
  skillIds,
  skillAttachments,
  userSkills,
  onSkillToggle,
  onSkillAttachmentChange,
}: AgentSkillsSectionProps) {
  return (
    <div className="space-y-2">
      <Label>Skills</Label>
      {userSkills.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No skills yet. Create skills in the Skills section.
        </p>
      ) : (
        <div className="max-h-96 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
          {userSkills.map((skill) => {
            const checked = skillIds.includes(skill.id);
            const attachment = skillAttachments.find((item) => item.skillId === skill.id);
            return (
              <SkillRow
                key={skill.id}
                skill={skill}
                checked={checked}
                attachment={attachment}
                onToggle={() => onSkillToggle(skill.id, checked)}
                onAttachmentChange={(field, value) => onSkillAttachmentChange(skill.id, field, value)}
              />
            );
          })}
        </div>
      )}
      {skillIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {skillIds.length} skill{skillIds.length !== 1 ? 's' : ''} attached
        </p>
      )}
    </div>
  );
}
