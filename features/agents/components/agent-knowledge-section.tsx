'use client';

import { Building2Icon, SparklesIcon } from 'lucide-react';
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
import type { Skill } from '@/features/skills/types';
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
  skillIds: string[];
  userDocuments: DocumentSummary[];
  userSkills: Skill[];
};

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
  skillIds,
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
        <p className="text-xs text-muted-foreground">
          Skills extend this agent with reusable prompt behaviors triggered by slash commands or keywords.
        </p>
        {userSkills.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            No skills yet. Create skills in the Skills section.
          </p>
        ) : (
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
            {userSkills.map((skill) => {
              const checked = skillIds.includes(skill.id);
              const triggerLabel =
                skill.triggerType === 'always'
                  ? 'always'
                  : skill.trigger
                    ? `${skill.trigger}`
                    : skill.triggerType;
              return (
                <div key={skill.id} className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    id={`skill-${skill.id}`}
                    checked={checked}
                    onChange={() => onSkillToggle(skill.id, checked)}
                    className="mt-0.5 size-3.5 cursor-pointer rounded border accent-primary"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <label
                      htmlFor={`skill-${skill.id}`}
                      className="flex cursor-pointer items-center gap-1.5 text-xs font-medium leading-none"
                    >
                      <SparklesIcon className="size-3 shrink-0 text-primary" />
                      {skill.name}
                      <span className="font-normal text-muted-foreground">· {triggerLabel}</span>
                    </label>
                    {skill.description && (
                      <p className="truncate text-xs text-muted-foreground">{skill.description}</p>
                    )}
                  </div>
                </div>
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
