'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  buildStructuredSystemPrompt,
  createDefaultAgentStructuredBehavior,
  createLegacyCompatibleStructuredBehavior,
  type AgentStructuredBehavior,
} from '@/lib/agent-structured-behavior';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { Brand } from '@/features/brands/types';
import { useUserDocuments } from '../hooks/use-agent-documents';
import { useUserSearch } from '../hooks/use-user-search';
import { AgentBehaviorSection } from './agent-behavior-section';
import { AgentGeneralSection } from './agent-general-section';
import { AgentKnowledgeSection } from './agent-knowledge-section';
import { AgentModelSection } from './agent-model-section';
import { AgentSettingsLayout } from './agent-settings-layout';
import { AgentSharingSection } from './agent-sharing-section';
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

const defaultSystemPrompt = '';
const toneOptions = ['Warm', 'Professional', 'Encouraging', 'Concise'];

const getInitialStructuredBehavior = (agent?: Agent | null) => {
  if (!agent) {
    return createDefaultAgentStructuredBehavior();
  }

  return agent.structuredBehavior ?? createLegacyCompatibleStructuredBehavior();
};

const buildFormSnapshot = ({
  brandId,
  description,
  documentIds,
  enabledTools,
  isPublic,
  modelId,
  name,
  sharedUserIds,
  skillIds,
  starterPrompts,
  structuredBehavior,
  systemPrompt,
}: {
  brandId: string;
  description: string;
  documentIds: string[];
  enabledTools: string[];
  isPublic: boolean;
  modelId: string;
  name: string;
  sharedUserIds: string[];
  skillIds: string[];
  starterPrompts: string[];
  structuredBehavior: AgentStructuredBehavior;
  systemPrompt: string;
}) => JSON.stringify({
  name,
  description,
  systemPrompt,
  modelId,
  enabledTools,
  documentIds,
  skillIds,
  brandId,
  isPublic,
  starterPrompts,
  sharedUserIds,
  structuredBehavior,
});

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
  const initialStructuredBehavior = useMemo(() => getInitialStructuredBehavior(agent), [agent, resetKey]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [modelId, setModelId] = useState<string>('auto');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [brandId, setBrandId] = useState<string>('none');
  const [docSearch, setDocSearch] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [starterPrompts, setStarterPrompts] = useState<string[]>([]);
  const [starterInput, setStarterInput] = useState('');
  const starterInputRef = useRef<HTMLInputElement>(null);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [behaviorMode, setBehaviorMode] = useState<'structured' | 'raw'>('structured');
  const [structuredRole, setStructuredRole] = useState('');
  const [structuredTones, setStructuredTones] = useState<string[]>([]);
  const [structuredLanguageThai, setStructuredLanguageThai] = useState(true);
  const [structuredLanguageEnglish, setStructuredLanguageEnglish] = useState(true);
  const [structuredLanguageMobileFriendly, setStructuredLanguageMobileFriendly] = useState(true);
  const [structuredInstructions, setStructuredInstructions] = useState<string[]>([]);
  const [structuredInstructionInput, setStructuredInstructionInput] = useState('');
  const [structuredContext, setStructuredContext] = useState('');
  const [structuredExampleReplies, setStructuredExampleReplies] = useState('');
  const [rawPromptCustomized, setRawPromptCustomized] = useState(false);

  const { data: userDocuments = [], isLoading: docsLoading } = useUserDocuments();
  const { data: searchResults = [] } = useUserSearch(shareSearch);
  const { data: userSkills = [] } = useSkills();

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    })();
  }, []);

  useEffect(() => {
    if (agent) {
      const persistedStructuredBehavior = initialStructuredBehavior;
      const persistedGeneratedPrompt = buildStructuredSystemPrompt(persistedStructuredBehavior);

      setName(agent.name);
      setDescription(agent.description ?? '');
      setSystemPrompt(agent.systemPrompt);
      setModelId(agent.modelId ?? 'auto');
      setEnabledTools(agent.enabledTools ?? []);
      setDocumentIds(agent.documentIds ?? []);
      setBrandId(agent.brandId ?? 'none');
      setIsPublic(agent.isPublic ?? false);
      setSharedWith((agent as AgentWithSharing).sharedWith ?? []);
      setSkillIds(agent.skillIds ?? []);
      setStarterPrompts(agent.starterPrompts ?? []);
      setBehaviorMode(agent.structuredBehavior ? 'structured' : agent.systemPrompt.trim() ? 'raw' : 'structured');
      setStructuredRole(persistedStructuredBehavior.role);
      setStructuredTones(persistedStructuredBehavior.tones);
      setStructuredLanguageThai(persistedStructuredBehavior.languageRules.replyInThaiWhenUserUsesThai);
      setStructuredLanguageEnglish(persistedStructuredBehavior.languageRules.replyInEnglishWhenUserUsesEnglish);
      setStructuredLanguageMobileFriendly(persistedStructuredBehavior.languageRules.keepRepliesMobileFriendly);
      setStructuredInstructions(persistedStructuredBehavior.keyInstructions);
      setStructuredContext(persistedStructuredBehavior.context);
      setStructuredExampleReplies(persistedStructuredBehavior.exampleReplies);
      setRawPromptCustomized(
        agent.structuredBehavior ? agent.systemPrompt.trim() !== persistedGeneratedPrompt.trim() : Boolean(agent.systemPrompt.trim())
      );
    } else {
      const emptyStructuredBehavior = initialStructuredBehavior;

      setName('');
      setDescription('');
      setSystemPrompt(defaultSystemPrompt);
      setModelId('auto');
      setEnabledTools([]);
      setDocumentIds([]);
      setBrandId('none');
      setIsPublic(false);
      setSharedWith([]);
      setSkillIds([]);
      setStarterPrompts([]);
      setBehaviorMode('structured');
      setStructuredRole(emptyStructuredBehavior.role);
      setStructuredTones(emptyStructuredBehavior.tones);
      setStructuredLanguageThai(emptyStructuredBehavior.languageRules.replyInThaiWhenUserUsesThai);
      setStructuredLanguageEnglish(emptyStructuredBehavior.languageRules.replyInEnglishWhenUserUsesEnglish);
      setStructuredLanguageMobileFriendly(emptyStructuredBehavior.languageRules.keepRepliesMobileFriendly);
      setStructuredInstructions(emptyStructuredBehavior.keyInstructions);
      setStructuredContext(emptyStructuredBehavior.context);
      setStructuredExampleReplies(emptyStructuredBehavior.exampleReplies);
      setRawPromptCustomized(false);
    }
    setStarterInput('');
    setDocSearch('');
    setShareSearch('');
    setStructuredInstructionInput('');
  }, [agent, initialStructuredBehavior, resetKey]);

  const structuredBehaviorDraft = useMemo<AgentStructuredBehavior>(
    () => ({
      version: 1,
      role: structuredRole,
      tones: structuredTones,
      languageRules: {
        replyInThaiWhenUserUsesThai: structuredLanguageThai,
        replyInEnglishWhenUserUsesEnglish: structuredLanguageEnglish,
        keepRepliesMobileFriendly: structuredLanguageMobileFriendly,
      },
      keyInstructions: structuredInstructions,
      context: structuredContext,
      exampleReplies: structuredExampleReplies,
    }),
    [
      structuredContext,
      structuredExampleReplies,
      structuredInstructions,
      structuredLanguageEnglish,
      structuredLanguageMobileFriendly,
      structuredLanguageThai,
      structuredRole,
      structuredTones,
    ]
  );

  const hasStructuredBehavior = useMemo(
    () =>
      structuredBehaviorDraft.role.trim().length > 0 ||
      structuredBehaviorDraft.tones.length > 0 ||
      structuredBehaviorDraft.languageRules.replyInThaiWhenUserUsesThai ||
      structuredBehaviorDraft.languageRules.replyInEnglishWhenUserUsesEnglish ||
      structuredBehaviorDraft.languageRules.keepRepliesMobileFriendly ||
      structuredBehaviorDraft.keyInstructions.length > 0 ||
      structuredBehaviorDraft.context.trim().length > 0 ||
      structuredBehaviorDraft.exampleReplies.trim().length > 0,
    [structuredBehaviorDraft]
  );

  const generatedPrompt = useMemo(
    () => buildStructuredSystemPrompt(structuredBehaviorDraft),
    [structuredBehaviorDraft]
  );

  const initialSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        brandId: agent?.brandId ?? 'none',
        description: agent?.description ?? '',
        documentIds: agent?.documentIds ?? [],
        enabledTools: agent?.enabledTools ?? [],
        isPublic: agent?.isPublic ?? false,
        modelId: agent?.modelId ?? 'auto',
        name: agent?.name ?? '',
        sharedUserIds: ((agent as AgentWithSharing | null)?.sharedWith ?? []).map((user) => user.id),
        skillIds: agent?.skillIds ?? [],
        starterPrompts: agent?.starterPrompts ?? [],
        structuredBehavior: initialStructuredBehavior,
        systemPrompt: agent?.systemPrompt ?? defaultSystemPrompt,
      }),
    [agent, initialStructuredBehavior]
  );

  const currentSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        brandId,
        description,
        documentIds,
        enabledTools,
        isPublic,
        modelId,
        name,
        sharedUserIds: sharedWith.map((user) => user.id),
        skillIds,
        starterPrompts,
        structuredBehavior: structuredBehaviorDraft,
        systemPrompt,
      }),
    [
      brandId,
      description,
      documentIds,
      enabledTools,
      isPublic,
      modelId,
      name,
      sharedWith,
      skillIds,
      starterPrompts,
      structuredBehaviorDraft,
      systemPrompt,
    ]
  );

  useEffect(() => {
    onDirtyChange?.(currentSnapshot !== initialSnapshot);
  }, [currentSnapshot, initialSnapshot, onDirtyChange]);

  useEffect(() => {
    if (!rawPromptCustomized) {
      setSystemPrompt(generatedPrompt);
    }
  }, [generatedPrompt, rawPromptCustomized]);

  const filteredDocuments = docSearch.trim()
    ? userDocuments.filter((d) => {
        const title = (d.metadata?.title as string) ?? d.id;
        return title.toLowerCase().includes(docSearch.toLowerCase());
      })
    : userDocuments;

  const unaddedResults = searchResults.filter((u) => !sharedWith.find((s) => s.id === u.id));
  const showNoResults = shareSearch.trim().length >= 2 && searchResults.length === 0;
  const isValid = name.trim().length > 0 && systemPrompt.trim().length > 0;
  const systemPromptChars = systemPrompt.length;
  const systemPromptLines = systemPrompt.length === 0 ? 0 : systemPrompt.split(/\r?\n/).length;
  const estimatedTokens = Math.ceil(systemPrompt.trim().length / 4);
  const isPanel = layout === 'panel';
  const resolvedActiveSection = activeSection ?? 'general';
  const activeSectionMeta = AGENT_EDITOR_SECTIONS.find((section) => section.id === resolvedActiveSection);

  const addStarterPrompt = () => {
    const value = starterInput.trim();
    if (!value || starterPrompts.length >= 4) return;
    setStarterPrompts((prev) => [...prev, value]);
    setStarterInput('');
    starterInputRef.current?.focus();
  };

  const addStructuredInstruction = () => {
    const value = structuredInstructionInput.trim();
    if (!value) return;
    setStructuredInstructions((prev) => [...prev, value]);
    setStructuredInstructionInput('');
  };

  const toggleStructuredTone = (tone: string) => {
    setStructuredTones((prev) =>
      prev.includes(tone) ? prev.filter((currentTone) => currentTone !== tone) : [...prev, tone]
    );
  };

  const applyGeneratedPrompt = () => {
    setRawPromptCustomized(false);
    setSystemPrompt(generatedPrompt);
  };

  const handleRawPromptChange = (value: string) => {
    setRawPromptCustomized(value.trim() !== generatedPrompt.trim());
    setSystemPrompt(value);
  };

  const behaviorSyncState = useMemo<'empty' | 'legacy' | 'synced' | 'diverged'>(
    () => {
      if (agent && !agent.structuredBehavior && agent.systemPrompt.trim()) {
        return 'legacy';
      }

      if (!hasStructuredBehavior || !generatedPrompt.trim()) {
        return 'empty';
      }

      return rawPromptCustomized ? 'diverged' : 'synced';
    },
    [agent, generatedPrompt, hasStructuredBehavior, rawPromptCustomized]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      systemPrompt: systemPrompt.trim(),
      structuredBehavior: hasStructuredBehavior ? structuredBehaviorDraft : null,
      modelId: modelId === 'auto' ? null : modelId,
      enabledTools,
      documentIds,
      skillIds,
      brandId: brandId === 'none' ? null : brandId,
      isPublic,
      starterPrompts,
      sharedUserIds: sharedWith.map((u) => u.id),
    });
  };

  const toggleTool = (toolId: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const addToShared = (user: SharedUser) => {
    setSharedWith((prev) => (prev.find((u) => u.id === user.id) ? prev : [...prev, user]));
    setShareSearch('');
  };

  const removeFromShared = (userId: string) => {
    setSharedWith((prev) => prev.filter((u) => u.id !== userId));
  };

  const generalSection = (
    <AgentGeneralSection
      description={description}
      name={name}
      onDescriptionChange={setDescription}
      onNameChange={setName}
      onStarterAdd={addStarterPrompt}
      onStarterInputChange={setStarterInput}
      onStarterInputKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addStarterPrompt();
        }
      }}
      onStarterRemove={(index) => setStarterPrompts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
      starterInput={starterInput}
      starterInputRef={starterInputRef}
      starterPrompts={starterPrompts}
    />
  );

  const behaviorSection = (
    <AgentBehaviorSection
      behaviorMode={behaviorMode}
      contextValue={structuredContext}
      estimatedTokens={estimatedTokens}
      exampleRepliesValue={structuredExampleReplies}
      generatedPrompt={generatedPrompt}
      hasStructuredBehavior={hasStructuredBehavior}
      isPanel={isPanel}
      isRawCustomized={hasStructuredBehavior && rawPromptCustomized}
      keyInstructionsValue={structuredInstructions}
      languageEnglish={structuredLanguageEnglish}
      languageMobileFriendly={structuredLanguageMobileFriendly}
      languageThai={structuredLanguageThai}
      onBehaviorModeChange={setBehaviorMode}
      onContextChange={setStructuredContext}
      onExampleRepliesChange={setStructuredExampleReplies}
      onKeyInstructionAdd={addStructuredInstruction}
      onKeyInstructionChange={(index, value) =>
        setStructuredInstructions((prev) => prev.map((instruction, itemIndex) => (itemIndex === index ? value : instruction)))
      }
      onKeyInstructionInputChange={setStructuredInstructionInput}
      onKeyInstructionRemove={(index) =>
        setStructuredInstructions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
      }
      onLanguageEnglishChange={setStructuredLanguageEnglish}
      onLanguageMobileFriendlyChange={setStructuredLanguageMobileFriendly}
      onLanguageThaiChange={setStructuredLanguageThai}
      onResetFromStructured={applyGeneratedPrompt}
      onRoleChange={setStructuredRole}
      onSystemPromptChange={handleRawPromptChange}
      onToneToggle={toggleStructuredTone}
      onUseGeneratedPrompt={applyGeneratedPrompt}
      roleValue={structuredRole}
      selectedTones={structuredTones}
      syncState={behaviorSyncState}
      systemPrompt={systemPrompt}
      systemPromptChars={systemPromptChars}
      systemPromptLines={systemPromptLines}
      toneOptions={toneOptions}
      workingInstructionValue={structuredInstructionInput}
    />
  );

  const modelSection = <AgentModelSection modelId={modelId} onModelChange={setModelId} />;

  const toolsSection = <AgentToolsSection enabledTools={enabledTools} onToggleTool={toggleTool} />;

  const knowledgeSection = (
    <AgentKnowledgeSection
      brandId={brandId}
      brands={brands}
      docSearch={docSearch}
      docsLoading={docsLoading}
      documentIds={documentIds}
      filteredDocuments={filteredDocuments}
      onBrandChange={setBrandId}
      onDocSearchChange={setDocSearch}
      onDocumentToggle={(documentId, checked) =>
        setDocumentIds((prev) =>
          checked ? [...prev, documentId] : prev.filter((currentDocumentId) => currentDocumentId !== documentId)
        )
      }
      onSkillToggle={(skillId, checked) =>
        setSkillIds((prev) => (checked ? [...prev, skillId] : prev.filter((id) => id !== skillId)))
      }
      skillIds={skillIds}
      userDocuments={userDocuments}
      userSkills={userSkills}
    />
  );

  const sharingSection = (
    <AgentSharingSection
      isPublic={isPublic}
      onIsPublicChange={setIsPublic}
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
    knowledge: knowledgeSection,
    tools: toolsSection,
    sharing: sharingSection,
    model: modelSection,
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
          {modelSection}
          {toolsSection}
          {knowledgeSection}
          {sharingSection}
          {formActions}
        </>
      )}
    </form>
  );
}
