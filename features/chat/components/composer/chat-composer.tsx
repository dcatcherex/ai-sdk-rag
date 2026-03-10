'use client';

import { useCallback, useState } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { BookOpenIcon, CheckIcon, GlobeIcon } from 'lucide-react';
import { useLiveVoice, type VoiceHistoryTurn } from '@/features/chat/hooks/use-live-voice';
import { VoiceMode } from '@/features/chat/components/voice-mode';
import { AgentSelector } from '@/features/agents/components/agent-selector';
import { PersonaSelector } from '@/features/chat/components/persona-selector';
import type { Agent } from '@/features/agents/types';
import type { CustomPersona } from '@/features/chat/types/custom-persona';
import type { ComparePresetMode } from '@/features/chat/hooks/use-compare-preset';
import { availableModels } from '@/lib/ai';
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { CompareModelPicker } from './compare-model-picker';
import { ComposerActionButtons } from './composer-action-buttons';
import { Dots, speedTier, costTier } from './model-dots';

// ── Inline attachments preview ────────────────────────────────────────────────

const ComposerAttachments = () => {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatComposerProps = {
  selectedDocCount: number;
  status: ChatStatus;
  error?: Error;
  selectedModel: string;
  selectorModels: { id: string; name: string; provider: string }[];
  currentModel: { name: string; provider: string };
  modelSelectorOpen: boolean;
  useWebSearch: boolean;
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  customPersonas: CustomPersona[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string | null) => void;
  onStop: () => void;
  onModelSelectorOpenChange: (open: boolean) => void;
  onSelectModel: (modelId: string) => void;
  onToggleWebSearch: () => void;
  onSuggestionClick: (suggestion: string) => void;
  onTranscriptionChange: (transcript: string) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
  onVoiceTurnComplete?: (userText: string, aiText: string) => Promise<void>;
  voiceHistory?: VoiceHistoryTurn[];
  // Compare mode
  compareMode: boolean;
  comparePresetIds: string[];
  comparePresetMode: ComparePresetMode;
  onToggleCompareMode: () => void;
  onToggleCompareModel: (modelId: string) => void;
  onClearComparePreset: () => void;
};

// ── ChatComposer ──────────────────────────────────────────────────────────────

export function ChatComposer({
  selectedDocCount,
  status,
  error,
  selectedModel,
  selectorModels,
  currentModel,
  modelSelectorOpen,
  useWebSearch,
  agents,
  selectedAgentId,
  onSelectAgent,
  customPersonas,
  selectedPersonaId,
  onSelectPersona,
  onStop,
  onModelSelectorOpenChange,
  onSelectModel,
  onToggleWebSearch,
  onTranscriptionChange,
  onSubmit,
  onVoiceTurnComplete,
  voiceHistory,
  compareMode,
  comparePresetIds,
  comparePresetMode,
  onToggleCompareMode,
  onToggleCompareModel,
  onClearComparePreset,
}: ChatComposerProps) {
  const [voiceOpen, setVoiceOpen] = useState(false);

  const { voiceState, transcript, micLevel, speakAloud, connect, disconnect, toggleSpeakAloud } =
    useLiveVoice({
      enabled: voiceOpen,
      onError: (msg) => toast.error('Voice error', { description: msg }),
      onTurnComplete: onVoiceTurnComplete,
      history: voiceHistory,
    });

  const handleOpenVoice = useCallback(() => {
    setVoiceOpen(true);
    void connect();
  }, [connect]);

  const handleCloseVoice = useCallback(() => {
    disconnect();
    setVoiceOpen(false);
  }, [disconnect]);

  return (
    <div className="relative border-t border-black/5 dark:border-white/10 px-3 py-3 md:px-6 md:py-4">
      {voiceOpen && (
        <div className="absolute bottom-full left-0 right-0 z-10 px-3 pb-1 md:px-6">
          <VoiceMode
            voiceState={voiceState}
            transcript={transcript}
            micLevel={micLevel}
            speakAloud={speakAloud}
            onClose={handleCloseVoice}
            onToggleSpeakAloud={toggleSpeakAloud}
          />
        </div>
      )}
      {selectedDocCount > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-primary">
          <BookOpenIcon className="size-3.5" />
          <span className="font-medium">
            Grounded mode — answering from {selectedDocCount} selected document
            {selectedDocCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <PromptInputProvider>
        <PromptInput onSubmit={(message) => onSubmit(message)}>
          <PromptInputHeader>
            <ComposerAttachments />
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              className="max-h-[40vh] overflow-y-auto leading-6"
              placeholder={
                compareMode
                  ? 'Type a prompt to compare across models…'
                  : 'Ask anything or drop files to ground the response.'
              }
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  {!compareMode && (
                    <PromptInputActionMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        onToggleWebSearch();
                      }}
                    >
                      <GlobeIcon className="mr-2 size-4" />
                      Web search
                      {useWebSearch && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                    </PromptInputActionMenuItem>
                  )}
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              {!compareMode && selectedPersonaId === null && (
                <AgentSelector
                  agents={agents}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={onSelectAgent}
                />
              )}
              {!compareMode && selectedAgentId === null && (
                <PersonaSelector
                  customPersonas={customPersonas}
                  selectedPersonaId={selectedPersonaId}
                  onSelectPersona={onSelectPersona}
                />
              )}
              {!compareMode && selectedAgentId === null && (
                <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      <ModelSelectorLogo provider={currentModel.provider} />
                      <ModelSelectorName>{currentModel.name}</ModelSelectorName>
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models…" />
                    <div className="flex items-center px-3 py-1.5 border-b border-black/5 dark:border-white/10">
                      <span className="flex-1 text-[11px] font-medium text-muted-foreground">Model</span>
                      <div className="flex gap-5 pr-1 text-[11px] font-medium text-muted-foreground">
                        <span>Speed</span>
                        <span>Cost</span>
                      </div>
                    </div>
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {selectorModels.map((model) => {
                        const fullModel = availableModels.find((m) => m.id === model.id);
                        const isAuto = model.id === 'auto';
                        return (
                          <ModelSelectorItem
                            key={model.id}
                            onSelect={() => onSelectModel(model.id)}
                            value={model.id}
                          >
                            <ModelSelectorLogo provider={model.provider} />
                            <ModelSelectorName>{model.name}</ModelSelectorName>
                            <div className="ml-auto flex items-center gap-3">
                              {!isAuto && (
                                <>
                                  <Dots filled={speedTier(fullModel)} color="bg-blue-400" />
                                  <Dots filled={costTier(fullModel)} color="bg-amber-400" />
                                </>
                              )}
                              {selectedModel === model.id && (
                                <CheckIcon className="size-3.5 text-primary" />
                              )}
                            </div>
                          </ModelSelectorItem>
                        );
                      })}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              )}
              <CompareModelPicker
                compareMode={compareMode}
                comparePresetIds={comparePresetIds}
                comparePresetMode={comparePresetMode}
                selectorModels={selectorModels}
                onToggleCompareMode={onToggleCompareMode}
                onToggleCompareModel={onToggleCompareModel}
                onClearComparePreset={onClearComparePreset}
              />
            </PromptInputTools>
            <ComposerActionButtons
              status={status}
              voiceOpen={voiceOpen}
              onStop={onStop}
              onOpenVoice={handleOpenVoice}
              onTranscriptionChange={onTranscriptionChange}
            />
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
      {error && (
        <p className="mt-2 text-xs text-destructive">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </div>
  );
}
