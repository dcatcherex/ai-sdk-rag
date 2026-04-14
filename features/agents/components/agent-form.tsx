'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { requestWorkspaceImageAssist, requestWorkspaceTextAssist } from '@/features/workspace-ai/client';
import { AiSuggestionDialog } from '@/features/workspace-ai/components/ai-suggestion-dialog';
import { Button } from '@/components/ui/button';
import type { SettingsShellItem } from '@/components/settings-shell';
import { persistGeneration } from '@/lib/clientPersist';
import { getPollingService } from '@/lib/polling/GenerationPollingService';
import { cn } from '@/lib/utils';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { Brand } from '@/features/brands/types';
import type { AgentSkillAttachmentInput, SkillActivationMode, SkillTriggerType } from '@/features/skills/types';
import { useUserDocuments } from '../hooks/use-agent-documents';
import { useAgentSkillAttachmentsWithPrefix } from '../hooks/use-agents';
import { useUserSearch } from '../hooks/use-user-search';
import { AgentBehaviorSection } from './agent-behavior-section';
import { AgentGeneralSection } from './agent-general-section';
import { AgentKnowledgeSection } from './agent-knowledge-section';
import { AgentSettingsLayout } from './agent-settings-layout';
import { AgentSharingSection } from './agent-sharing-section';
import { AgentSkillsSection } from './agent-skills-section';
import { AgentToolsSection } from './agent-tools-section';
import { AgentMcpSection } from './agent-mcp-section';
import { AGENT_EDITOR_SECTIONS, type AgentEditorSection, type AgentEditorSectionId } from './agent-editor-sections';
import type { Agent, AgentWithSharing, CreateAgentInput, McpServerConfig, SharedUser } from '../types';

type AgentFormProps = {
  activeSection?: string;
  agent?: Agent | null;
  customSections?: Array<SettingsShellItem<string> & { content: ReactNode }>;
  enableBrandSelection?: boolean;
  extraContent?: ReactNode;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSectionChange?: (section: string) => void;
  onSubmit: (data: CreateAgentInput) => void;
  isPending?: boolean;
  layout?: 'dialog' | 'panel';
  resetKey?: string | boolean;
  skillAttachmentsRoutePrefix?: string;
  submitLabel: string;
  visibleSections?: AgentEditorSectionId[];
};

type AgentCoverImageOptions = {
  instruction?: string;
  modelId?: string;
  aspectRatio?: string;
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
  customSections,
  enableBrandSelection = true,
  extraContent,
  onCancel,
  onDirtyChange,
  onSectionChange,
  onSubmit,
  isPending,
  layout = 'dialog',
  resetKey,
  skillAttachmentsRoutePrefix = '/api/agents',
  submitLabel,
  visibleSections,
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
  const [isGeneratingCoverImage, setIsGeneratingCoverImage] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingStarters, setIsGeneratingStarters] = useState(false);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [starterSuggestions, setStarterSuggestions] = useState<string[]>([]);
  const [descriptionSuggestionsOpen, setDescriptionSuggestionsOpen] = useState(false);
  const [starterSuggestionsOpen, setStarterSuggestionsOpen] = useState(false);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [skillAttachments, setSkillAttachments] = useState<AgentSkillAttachmentInput[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>([]);

  const { data: userDocuments = [], isLoading: docsLoading } = useUserDocuments();
  const { data: searchResults = [] } = useUserSearch(shareSearch);
  const skillsQuery = useSkills();
  const userSkills = skillsQuery.data?.skills ?? [];
  const { data: loadedSkillAttachments = [] } = useAgentSkillAttachmentsWithPrefix(
    agent?.id ?? null,
    skillAttachmentsRoutePrefix,
  );
  const loadedAttachmentAgentIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const initialSnapshotRef = useRef<string | null>(null);

  const selectedSkillIds = sortSkillAttachments(skillAttachments).map((a) => a.skillId);

  useEffect(() => {
    void (async () => {
      if (!enableBrandSelection) {
        setBrands([]);
        return;
      }

      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    })();
  }, [enableBrandSelection]);

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
      setMcpServers(agent.mcpServers ?? []);
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
      setMcpServers([]);
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
    mcpServers,
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
  const allowedSections = visibleSections ?? AGENT_EDITOR_SECTIONS.map((section) => section.id);
  const visibleSectionSet = new Set<AgentEditorSectionId>(allowedSections);
  const filteredSections = AGENT_EDITOR_SECTIONS.filter((section) => visibleSectionSet.has(section.id));
  const combinedSections = [
    ...filteredSections,
    ...(customSections ?? []),
  ] satisfies Array<AgentEditorSection | SettingsShellItem<string>>;
  const combinedSectionIds = new Set(combinedSections.map((section) => section.id));
  const fallbackSection = combinedSections[0]?.id ?? 'general';
  const resolvedActiveSection = activeSection && combinedSectionIds.has(activeSection)
    ? activeSection
    : fallbackSection;
  const activeSectionMeta = combinedSections.find((s) => s.id === resolvedActiveSection);

  const addStarterPrompt = () => {
    const value = starterInput.trim();
    if (!value || starterPrompts.length >= 4) return;
    markUserEdited();
    setStarterPrompts((prev) => [...prev, value]);
    setStarterInput('');
    starterInputRef.current?.focus();
  };

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required first');
      return;
    }
    if (!systemPrompt.trim()) {
      toast.error('AI Behavior is required first', {
        description: 'Add the agent instructions before asking AI to write a description.',
      });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const result = await requestWorkspaceTextAssist('agent-description', {
        context: {
          entityType: 'agent',
          entityId: agent?.id,
          name,
          systemPrompt,
          currentValue: description,
        },
      });

      if (result.suggestions.length === 0) throw new Error('No description returned');
      setDescriptionSuggestions(result.suggestions);
      setDescriptionSuggestionsOpen(true);
    } catch (error) {
      toast.error('Failed to generate description', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerateCoverImage = async (options: AgentCoverImageOptions = {}) => {
    if (!name.trim()) {
      toast.error('Agent name is required first');
      return;
    }
    if (!systemPrompt.trim() && !description.trim()) {
      toast.error('Add more agent context first', {
        description: 'Provide a description or AI behavior so the cover image has something to represent.',
      });
      return;
    }

    setIsGeneratingCoverImage(true);
    try {
      const generation = await requestWorkspaceImageAssist({
        kind: 'agent-cover',
        instruction: options.instruction,
        modelId: options.modelId,
        aspectRatio: options.aspectRatio,
        context: {
          entityType: 'agent',
          entityId: agent?.id,
          name,
          systemPrompt,
          currentValue: description,
        },
      });

      const pollResult = await getPollingService().poll(
        {
          taskId: generation.taskId,
          generationId: generation.generationId,
          modelId: generation.modelId,
          promptId: generation.generationId,
          promptTitle: generation.prompt,
        },
        { autoPersist: false },
      );

      if (pollResult.status !== 'success' || !pollResult.output) {
        throw new Error(pollResult.error ?? 'Image generation did not complete successfully');
      }

      let finalUrl = pollResult.output;
      if (pollResult.needsPersist) {
        const persisted = await persistGeneration(generation.generationId, pollResult.output);
        if (!persisted.success || !persisted.publicUrl) {
          throw new Error('Image generated, but saving the final cover image failed');
        }
        finalUrl = persisted.publicUrl;
      }

      markUserEdited();
      setImageUrl(finalUrl);
      toast.success('Cover image generated');
    } catch (error) {
      toast.error('Failed to generate cover image', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingCoverImage(false);
    }
  };

  const handleGenerateStarters = async () => {
    if (!name.trim()) {
      toast.error('Agent name is required first');
      return;
    }
    if (!systemPrompt.trim()) {
      toast.error('AI Behavior is required first', {
        description: 'Add the agent instructions before asking AI to suggest starters.',
      });
      return;
    }

    setIsGeneratingStarters(true);
    try {
      const result = await requestWorkspaceTextAssist('agent-starters', {
        context: {
          entityType: 'agent',
          entityId: agent?.id,
          name,
          systemPrompt,
          extra: { starterPrompts },
        },
      });

      if (result.suggestions.length === 0) throw new Error('No starters returned');
      setStarterSuggestions(result.suggestions.slice(0, 4));
      setStarterSuggestionsOpen(true);
    } catch (error) {
      toast.error('Failed to generate starters', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingStarters(false);
    }
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
      mcpServers,
    });
  };

  const generalSection = (
    <AgentGeneralSection
      description={description}
      imageUrl={imageUrl}
      isGeneratingCoverImage={isGeneratingCoverImage}
      isGeneratingDescription={isGeneratingDescription}
      isGeneratingStarters={isGeneratingStarters}
      modelId={modelId}
      name={name}
      onDescriptionChange={(value) => { markUserEdited(); setDescription(value); }}
      onGenerateCoverImage={(options) => { void handleGenerateCoverImage(options); }}
      onGenerateDescription={() => { void handleGenerateDescription(); }}
      onGenerateStarters={() => { void handleGenerateStarters(); }}
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
      brands={enableBrandSelection ? brands : []}
      onBrandChange={(value) => { markUserEdited(); setBrandId(value); }}
      systemPrompt={systemPrompt}
      onSystemPromptChange={(value) => { markUserEdited(); setSystemPrompt(value); }}
    />
  );

  const toolsSection = <AgentToolsSection enabledTools={enabledTools} onToggleTool={toggleTool} />;

  const mcpSection = (
    <AgentMcpSection
      mcpServers={mcpServers}
      onChange={(servers) => { markUserEdited(); setMcpServers(servers); }}
    />
  );

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

  const panelSectionContent: Record<string, ReactNode> = {
    general: generalSection,
    behavior: behaviorSection,
    skills: skillsSection,
    knowledge: knowledgeSection,
    tools: toolsSection,
    mcp: mcpSection,
    sharing: sharingSection,
  };
  for (const section of customSections ?? []) {
    panelSectionContent[section.id] = section.content;
  }

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
    <>
      <form onSubmit={handleSubmit} className={cn('space-y-4', isPanel && 'flex min-h-0 flex-1 flex-col overflow-hidden gap-6 space-y-0')}>
        {isPanel ? (
          <AgentSettingsLayout
            activeSection={resolvedActiveSection}
            footer={formActions}
            items={combinedSections}
            onSectionChange={onSectionChange ?? (() => undefined)}
            sectionDescription={activeSectionMeta?.description}
            sectionTitle={activeSectionMeta?.label ?? 'General'}
          >
            {panelSectionContent[resolvedActiveSection]}
          </AgentSettingsLayout>
        ) : (
          <>
            {visibleSectionSet.has('general') ? generalSection : null}
            {visibleSectionSet.has('behavior') ? behaviorSection : null}
            {visibleSectionSet.has('skills') ? skillsSection : null}
            {visibleSectionSet.has('tools') ? toolsSection : null}
            {visibleSectionSet.has('mcp') ? mcpSection : null}
            {visibleSectionSet.has('knowledge') ? knowledgeSection : null}
            {visibleSectionSet.has('sharing') ? sharingSection : null}
            {extraContent}
            {formActions}
          </>
        )}
      </form>

      <AiSuggestionDialog
        open={descriptionSuggestionsOpen}
        onOpenChange={setDescriptionSuggestionsOpen}
        title="Description Suggestions"
        description="Choose the draft description that fits this agent best."
        suggestions={descriptionSuggestions}
        onSelect={(suggestion) => {
          markUserEdited();
          setDescription(suggestion);
          setDescriptionSuggestionsOpen(false);
          toast.success('Description applied');
        }}
      />

      <AiSuggestionDialog
        open={starterSuggestionsOpen}
        onOpenChange={setStarterSuggestionsOpen}
        title="Conversation Starter Suggestions"
        description="Pick one starter or apply the full set."
        suggestions={starterSuggestions}
        onSelect={(suggestion) => {
          markUserEdited();
          setStarterPrompts((prev) => {
            if (prev.includes(suggestion)) return prev;
            return [...prev, suggestion].slice(0, 4);
          });
          setStarterSuggestionsOpen(false);
          toast.success('Starter applied');
        }}
        primaryActionLabel="Use all"
        onPrimaryAction={() => {
          markUserEdited();
          setStarterPrompts(starterSuggestions.slice(0, 4));
          setStarterInput('');
          setStarterSuggestionsOpen(false);
          toast.success('Conversation starters applied');
        }}
      />
    </>
  );
}
