'use client';

import { useState } from 'react';
import { Building2Icon, ChevronDownIcon, ChevronUpIcon, SparklesIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Brand } from '@/features/brands/types';
import type { AgentSkillAttachmentInput, Skill, SkillActivationMode, SkillTriggerType } from '@/features/skills/types';
import type { DocumentSummary } from '../hooks/use-agent-documents';

type AgentKnowledgeSectionProps = {
  brandId: string;
  brands: Brand[];
  docSearch: string;
  docsLoading: boolean;
  documentIds: string[];
  filteredDocuments: DocumentSummary[];
  onBrandChange: (value: string) => void;
  onDocSearchChange: (value: string) => void;
  onDocumentToggle: (documentId: string, checked: boolean) => void;
  onSkillToggle: (skillId: string, checked: boolean) => void;
  onSkillAttachmentChange: (
    skillId: string,
    field: 'activationModeOverride' | 'triggerTypeOverride' | 'triggerOverride' | 'priority',
    value: SkillActivationMode | SkillTriggerType | string | number | null,
  ) => void;
  skillIds: string[];
  skillAttachments: AgentSkillAttachmentInput[];
  userDocuments: DocumentSummary[];
  userSkills: Skill[];
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

export function AgentKnowledgeSection({
  brandId,
  brands,
  docSearch,
  docsLoading,
  documentIds,
  filteredDocuments,
  onBrandChange,
  onDocSearchChange,
  onDocumentToggle,
  onSkillToggle,
  onSkillAttachmentChange,
  skillIds,
  skillAttachments,
  userDocuments,
  userSkills,
}: AgentKnowledgeSectionProps) {
  return (
    <div className="space-y-5">
      {brands.length > 0 && (
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Select value={brandId} onValueChange={onBrandChange}>
            <SelectTrigger>
              <SelectValue placeholder="No brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2Icon className="size-3.5" />
                  No brand
                </span>
              </SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full"
                      style={{ background: brand.colors[0]?.hex ?? 'hsl(var(--muted))' }}
                    />
                    {brand.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Brand context is automatically injected into this agent&apos;s system prompt.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Skills</Label>
        {userSkills.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No skills yet. Create skills in the Skills section.
          </p>
        ) : (
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
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

      <div className="space-y-2">
        <Label>Knowledge Documents</Label>
        <p className="text-xs text-muted-foreground">
          These documents are automatically used when this agent is active — no manual selection needed.
        </p>
        {docsLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : userDocuments.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No documents yet. Upload in the Knowledge section.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Input
              placeholder="Search documents…"
              value={docSearch}
              onChange={(event) => onDocSearchChange(event.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
              {filteredDocuments.map((doc) => {
                const title = (doc.metadata?.title as string | undefined) ?? doc.id;
                const checked = documentIds.includes(doc.id);
                return (
                  <div key={doc.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={checked}
                      onCheckedChange={(checkedState) => onDocumentToggle(doc.id, Boolean(checkedState))}
                    />
                    <label
                      htmlFor={`doc-${doc.id}`}
                      className="cursor-pointer truncate text-xs leading-none"
                      title={title}
                    >
                      {title}
                    </label>
                  </div>
                );
              })}
            </div>
            {documentIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {documentIds.length} document{documentIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
