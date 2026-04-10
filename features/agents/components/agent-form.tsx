'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { Brand } from '@/features/brands/types';
import type { AgentSkillAttachmentInput, SkillActivationMode, SkillTriggerType } from '@/features/skills/types';
import { useUserDocuments } from '../hooks/use-agent-documents';
import { useAgentSkillAttachments } from '../hooks/use-agents';
import { useUserSearch } from '../hooks/use-user-search';
import { AgentBehaviorSection } from './agent-behavior-section';
import { AgentGeneralSection } from './agent-general-section';
import { AgentKnowledgeSection } from './agent-knowledge-section';
import { AgentSettingsLayout } from './agent-settings-layout';
import { AgentSharingSection } from './agent-sharing-section';
import { AgentSkillsSection } from './agent-skills-section';
import { AgentToolsSection } from './agent-tools-section';
import { AGENT_EDITOR_SECTIONS, type AgentEditorSectionId } from './agent-editor-sections';
import type { Agent, AgentWithSharing, CreateAgentInput, SharedUser } from '../types';

type AgentFormProps = {
  activeSection?: AgentEditorSectionId;
  agent?: Agent | null;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSectionChange?: (section: AgentEditorSectionId) => void;
  onSubmit: (data: CreateAgentInput) => void;
  isPending?: boolean;
  layout?: 'dialog' | 'panel';
  resetKey?: string | boolean;
  submitLabel: string;
};

const sortSkillAttachments = (attachments: AgentSkillAttachmentInput[]) =>
  [...attachments].sort(
    (a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || a.skillId.localeCompare(b.skillId),
  );

const normalizeSkillAttachmentsForForm = (agent?: Agent | AgentWithSharing | null): AgentSkillAttachmentInput[] => {
  const existingAttachments = (agent as AgentWithSharing | null)?.skillAttachments ?? [];
  return sortSkillAttachments(
    existingAttachments.map((attachment, index) => ({
      skillId: attachment.skillId,
      isEnabled: attachment.isEnabled,
      activationModeOverride: attachment.activationModeOverride,
      triggerTypeOverride: attachment.triggerTypeOverride,
      triggerOverride: attachment.triggerOverride,
      priority: attachment.priority ?? index,
      notes: attachment.notes,
    })),
  );
};

export function AgentForm({
  activeSection,
  agent,
  onCancel,
  onDirtyChange,
  onSectionChange,
  onSubmit,
  isPending,
  layout = 'dialog',
  resetKey,
  submitLabel,
}: AgentFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelId, setModelId] = useState<string>('auto');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [brandId, setBrandId] = useState<string>('none');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [docSearch, setDocSearch] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [starterInput, setStarterInput] = useState('');
  const starterInputRef = useRef<HTMLInputElement>(null);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [skillAttachments, setSkillAttachments] = useState<AgentSkillAttachmentInput[]>([]);

  const { data: userDocuments = [], isLoading: docsLoading } = useUserDocuments();
  const { data: searchResults = [] } = useUserSearch(shareSearch);
  const { data: userSkills = [] } = useSkills();
  const { data: loadedSkillAttachments = [] } = useAgentSkillAttachments(agent?.id ?? null);
  const loadedAttachmentAgentIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const initialSnapshotRef = useRef<string | null>(null);

  const selectedSkillIds = sortSkillAttachments(skillAttachments).map((a) => a.skillId);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    })();
  }, []);

  useEffect(() => {
    isInitializedRef.current = false;
    hasUserEditedRef.current = false;
    initialSnapshotRef.current = null;
    if (agent) {
      setName(agent.name);
      setDescription(agent.description ?? '');
      setSystemPrompt(agent.systemPrompt);
      setModelId(agent.modelId ?? 'auto');
      setEnabledTools(agent.enabledTools ?? []);
      setDocumentIds(agent.documentIds ?? []);
      setBrandId(agent.brandId ?? 'none');
      setImageUrl(agent.imageUrl ?? '');
      setIsPublic(agent.isPublic ?? false);
      setSharedWith((agent as AgentWithSharing).sharedWith ?? []);
      setSkillAttachments(normalizeSkillAttachmentsForForm(agent as AgentWithSharing));
      setStarterPrompts(agent.starterPrompts ?? []);
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
      setModelId('auto');
      setEnabledTools([]);
      setDocumentIds([]);
      setBrandId('none');
      setImageUrl('');
      setIsPublic(false);
      setSharedWith([]);
      setSkillAttachments([]);
      setStarterPrompts([]);
    }
    setStarterInput('');
    setDocSearch('');
    setShareSearch('');
    loadedAttachmentAgentIdRef.current = agent?.id ?? null;
    isInitializedRef.current = true;
  }, [agent, resetKey]);

  useEffect(() => {
    if (!agent?.id) return;
    if (loadedAttachmentAgentIdRef.current === `${agent.id}:loaded`) return;
    if (loadedSkillAttachments.length === 0) return;

    const normalizedAttachments = sortSkillAttachments(
      loadedSkillAttachments.map((attachment, index) => ({
        skillId: attachment.skillId,
        isEnabled: attachment.isEnabled,
        activationModeOverride: attachment.activationModeOverride,
        triggerTypeOverride: attachment.triggerTypeOverride,
        triggerOverride: attachment.triggerOverride,
        priority: attachment.priority ?? index,
        notes: attachment.notes,
      })),
    );

    setSkillAttachments(normalizedAttachments);
    loadedAttachmentAgentIdRef.current = `${agent.id}:loaded`;
    if (!hasUserEditedRef.current) {
      initialSnapshotRef.current = null;
    }
  }, [agent?.id, loadedSkillAttachments]);

  const markUserEdited = () => { hasUserEditedRef.current = true; };

  // Dirty tracking
  const currentSnapshot = JSON.stringify({
    name, description, systemPrompt, modelId, enabledTools, documentIds,
    brandId, imageUrl, isPublic, starterPrompts,
    sharedUserIds: sharedWith.map((u) => u.id),
    skillAttachments: sortSkillAttachments(skillAttachments),
  });

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (initialSnapshotRef.current === null) {
      initialSnapshotRef.current = currentSnapshot;
      onDirtyChange?.(false);
      return;
    }
    onDirtyChange?.(hasUserEditedRef.current && currentSnapshot !== initialSnapshotRef.current);
  }, [currentSnapshot, onDirtyChange]);

  const filteredDocuments = docSearch.trim()
    ? userDocuments.filter((d) => {
        const title = (d.metadata?.title as string) ?? d.id;
        return title.toLowerCase().includes(docSearch.toLowerCase());
      })
    : userDocuments;

  const unaddedResults = searchResults.filter((u) => !sharedWith.find((s) => s.id === u.id));
  const showNoResults = shareSearch.trim().length >= 2 && searchResults.length === 0;
  const isValid = name.trim().length > 0 && systemPrompt.trim().length > 0;
  const isPanel = layout === 'panel';
  const resolvedActiveSection = activeSection ?? 'general';
  const activeSectionMeta = AGENT_EDITOR_SECTIONS.find((s) => s.id === resolvedActiveSection);

  const addStarterPrompt = () => {
    const value = starterInput.trim();
    if (!value || starterPrompts.length >= 4) return;
    markUserEdited();
    setStarterPrompts((prev) => [...prev, value]);
    setStarterInput('');
    starterInputRef.current?.focus();
  };

  const toggleTool = (toolId: string) => {
    markUserEdited();
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const addToShared = (user: SharedUser) => {
    markUserEdited();
    setSharedWith((prev) => (prev.find((u) => u.id === user.id) ? prev : [...prev, user]));
    setShareSearch('');
  };

  const removeFromShared = (userId: string) => {
    markUserEdited();
    setSharedWith((prev) => prev.filter((u) => u.id !== userId));
  };

  const toggleSkillAttachment = (skillId: string, currentlySelected: boolean) => {
    markUserEdited();
    if (currentlySelected) {
      setSkillAttachments((prev) => prev.filter((a) => a.skillId !== skillId));
      return;
    }
    setSkillAttachments((prev) => [...prev, { skillId, isEnabled: true, priority: prev.length }]);
  };

  const updateSkillAttachment = (
    skillId: string,
    field: 'activationModeOverride' | 'triggerTypeOverride' | 'triggerOverride' | 'priority',
    value: SkillActivationMode | SkillTriggerType | string | number | null,
  ) => {
    markUserEdited();
    setSkillAttachments((prev) =>
      sortSkillAttachments(
        prev.map((attachment) => {
          if (attachment.skillId !== skillId) return attachment;
          if (field === 'priority') return { ...attachment, priority: typeof value === 'number' ? value : undefined };
          if (field === 'triggerOverride') return { ...attachment, triggerOverride: typeof value === 'string' ? value : null };
          if (field === 'triggerTypeOverride') return { ...attachment, triggerTypeOverride: (value as SkillTriggerType | null) ?? null };
          return { ...attachment, activationModeOverride: (value as SkillActivationMode | null) ?? null };
        }),
      ),
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim(),
      structuredBehavior: null,
      modelId: modelId === 'auto' ? null : modelId,
      enabledTools,
      documentIds,
      skillAttachments: sortSkillAttachments(skillAttachments),
      brandId: brandId === 'none' ? null : brandId,
      imageUrl: imageUrl || null,
      isPublic,
      starterPrompts,
      sharedUserIds: sharedWith.map((u) => u.id),
    });
  };

  const generalSection = (
    <AgentGeneralSection
      description={description}
      imageUrl={imageUrl}
      modelId={modelId}
      name={name}
      onDescriptionChange={(value) => { markUserEdited(); setDescription(value); }}
      onImageUrlChange={(url) => { markUserEdited(); setImageUrl(url); }}
      onModelChange={(value) => { markUserEdited(); setModelId(value); }}
      onNameChange={(value) => { markUserEdited(); setName(value); }}
      onStarterAdd={addStarterPrompt}
      onStarterInputChange={setStarterInput}
      onStarterInputKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); addStarterPrompt(); }
      }}
      onStarterRemove={(index) => {
        markUserEdited();
        setStarterPrompts((prev) => prev.filter((_, i) => i !== index));
      }}
      starterInput={starterInput}
      starterInputRef={starterInputRef}
      starterPrompts={starterPrompts}
    />
  );

  const behaviorSection = (
    <AgentBehaviorSection
      brandId={brandId}
      brands={brands}
      onBrandChange={(value) => { markUserEdited(); setBrandId(value); }}
      systemPrompt={systemPrompt}
      onSystemPromptChange={(value) => { markUserEdited(); setSystemPrompt(value); }}
    />
  );

  const toolsSection = <AgentToolsSection enabledTools={enabledTools} onToggleTool={toggleTool} />;

  const skillsSection = (
    <AgentSkillsSection
      skillIds={selectedSkillIds}
      skillAttachments={skillAttachments}
      userSkills={userSkills}
      onSkillToggle={toggleSkillAttachment}
      onSkillAttachmentChange={updateSkillAttachment}
    />
  );

  const knowledgeSection = (
    <AgentKnowledgeSection
      docSearch={docSearch}
      docsLoading={docsLoading}
      documentIds={documentIds}
      filteredDocuments={filteredDocuments}
      onDocSearchChange={setDocSearch}
      onDocumentToggle={(documentId, checked) => {
        markUserEdited();
        setDocumentIds((prev) =>
          checked ? [...prev, documentId] : prev.filter((id) => id !== documentId)
        );
      }}
      userDocuments={userDocuments}
    />
  );

  const sharingSection = (
    <AgentSharingSection
      isPublic={isPublic}
      onIsPublicChange={(value) => { markUserEdited(); setIsPublic(value); }}
      onShareSearchChange={setShareSearch}
      onSharedUserAdd={addToShared}
      onSharedUserRemove={removeFromShared}
      shareSearch={shareSearch}
      sharedWith={sharedWith}
      showNoResults={showNoResults}
      unaddedResults={unaddedResults}
    />
  );

  const panelSectionContent: Record<AgentEditorSectionId, ReactNode> = {
    general: generalSection,
    behavior: behaviorSection,
    skills: skillsSection,
    knowledge: knowledgeSection,
    tools: toolsSection,
    sharing: sharingSection,
  };

  const formActions = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
        Cancel
      </Button>
      <Button type="submit" disabled={!isValid || isPending}>
        {isPending ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', isPanel && 'flex min-h-0 flex-1 flex-col overflow-hidden gap-6 space-y-0')}>
      {isPanel ? (
        <AgentSettingsLayout
          activeSection={resolvedActiveSection}
          footer={formActions}
          onSectionChange={onSectionChange ?? (() => undefined)}
          sectionDescription={activeSectionMeta?.description}
          sectionTitle={activeSectionMeta?.label ?? 'General'}
        >
          {panelSectionContent[resolvedActiveSection]}
        </AgentSettingsLayout>
      ) : (
        <>
          {generalSection}
          {behaviorSection}
          {skillsSection}
          {toolsSection}
          {knowledgeSection}
          {sharingSection}
          {formActions}
        </>
      )}
    </form>
  );
}
