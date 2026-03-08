'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { AudioLinesIcon, BookOpenIcon, CheckIcon, Columns2Icon, GlobeIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useLiveVoice, type VoiceHistoryTurn } from '@/features/chat/hooks/use-live-voice';
import { VoiceMode } from '@/features/chat/components/voice-mode';
import { AgentSelector } from '@/features/agents/components/agent-selector';
import type { Agent } from '@/features/agents/types';
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
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputProvider,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const composerSuggestions = [
  'Summarize this in bullet points',
  'Rewrite this to sound professional',
  'Turn this into a checklist',
  'Translate this to Thai and English',
];

// ── Compare model picker popover ─────────────────────────────────────────────

type CompareModelPickerProps = {
  compareMode: boolean;
  comparePresetIds: string[];
  comparePresetMode: ComparePresetMode;
  selectorModels: { id: string; name: string; provider: string }[];
  onToggleCompareMode: () => void;
  onToggleCompareModel: (modelId: string) => void;
  onClearComparePreset: () => void;
};

const CompareModelPicker = ({
  compareMode,
  comparePresetIds,
  comparePresetMode,
  selectorModels,
  onToggleCompareMode,
  onToggleCompareModel,
  onClearComparePreset,
}: CompareModelPickerProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const models = selectorModels.filter((m) => m.id !== 'auto');
  const typeLabel =
    comparePresetMode === 'image' ? 'Image models'
    : comparePresetMode === 'text' ? 'Text models'
    : null;

  const handleCompareClick = () => {
    if (!compareMode) {
      // Turning on: auto-open picker if not enough models selected
      onToggleCompareMode();
      if (comparePresetIds.length < 2) setPickerOpen(true);
    } else {
      // Turning off
      onToggleCompareMode();
    }
  };

  const ModelPickerPopover = (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Select models to compare"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            compareMode
              ? 'text-primary-foreground hover:bg-white/15'
              : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <SlidersHorizontalIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Compare models</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {comparePresetIds.length < 2
                ? `Select at least 2 to enable · ${comparePresetIds.length} selected`
                : `${comparePresetIds.length} of 4 selected · active`}
            </p>
          </div>
          {comparePresetIds.length > 0 && (
            <button
              type="button"
              onClick={onClearComparePreset}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-3" />
              Clear
            </button>
          )}
        </div>

        {/* Type lock notice */}
        {typeLabel && (
          <div className="border-b border-black/5 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              Locked to <span className="font-medium text-foreground">{typeLabel}</span>
              {' '}— clear to switch type
            </span>
          </div>
        )}

        {/* Model list */}
        <div className="max-h-60 overflow-y-auto overscroll-contain">
          <div className="p-1.5">
            {models.map((model) => {
              const selected = comparePresetIds.includes(model.id);
              const fullModel = availableModels.find((m) => m.id === model.id);
              const caps = fullModel?.capabilities ?? [];
              const isImageModel = caps.some((c) => c === 'image gen');
              const maxReached = !selected && comparePresetIds.length >= 4;
              const typeMismatch =
                !selected &&
                comparePresetMode !== null &&
                (comparePresetMode === 'image') !== isImageModel;
              const disabled = maxReached || typeMismatch;

              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleCompareModel(model.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-30'
                      : selected
                        ? 'bg-primary/8 dark:bg-primary/15 hover:bg-primary/12 dark:hover:bg-primary/20'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled}
                    className="pointer-events-none shrink-0"
                    onCheckedChange={() => {}}
                  />
                  <ModelSelectorLogo provider={model.provider} />
                  <span className={`flex-1 truncate text-[12px] ${selected ? 'font-medium text-foreground' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {model.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Same model type only · max 4</span>
          {comparePresetIds.length >= 2 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
              <CheckIcon className="size-3" />
              Ready
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={`flex items-center rounded-md transition-colors ${compareMode ? 'bg-primary text-primary-foreground' : ''}`}>
      <button
        type="button"
        onClick={handleCompareClick}
        title={compareMode ? 'Cancel compare' : 'Compare models'}
        className={`flex h-8 items-center gap-1.5 rounded-l-md px-2.5 text-[13px] font-medium transition-colors ${
          compareMode
            ? 'text-primary-foreground hover:bg-white/15'
            : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <Columns2Icon className="size-4" />
        <span className="hidden sm:inline">Compare</span>
        {comparePresetIds.length > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            compareMode ? 'bg-white/20' : 'bg-primary/15 text-primary'
          }`}>
            {comparePresetIds.length}
          </span>
        )}
      </button>
      <div className={`w-px self-stretch ${compareMode ? 'bg-white/20' : 'bg-black/8 dark:bg-white/10'}`} />
      {ModelPickerPopover}
    </div>
  );
};

// ── Attachments ───────────────────────────────────────────────────────────────

const ComposerAttachments = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

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

// ── Composer action buttons (voice / submit) ──────────────────────────────────

type ComposerActionButtonsProps = {
  status: ChatStatus;
  voiceOpen: boolean;
  onStop: () => void;
  onOpenVoice: () => void;
  onTranscriptionChange: (transcript: string) => void;
};

const ComposerActionButtons = ({
  status,
  voiceOpen,
  onStop,
  onOpenVoice,
  onTranscriptionChange,
}: ComposerActionButtonsProps) => {
  const { textInput } = usePromptInputController();
  const [isDictating, setIsDictating] = useState(false);
  const isEmpty = textInput.value.trim() === '';
  const isGenerating = status === 'submitted' || status === 'streaming';

  // Keep textInput in a ref so handleTranscription stays stable (no recognition restarts)
  const textInputRef = useRef(textInput);
  textInputRef.current = textInput;

  const handleTranscription = useCallback((transcript: string) => {
    const current = textInputRef.current.value;
    const next = current ? `${current} ${transcript}` : transcript;
    textInputRef.current.setInput(next);
    onTranscriptionChange(next);
  }, [onTranscriptionChange]);

  const handleAudioRecorded = useCallback(async (audioBlob: Blob): Promise<string> => {
    const toastId = toast.loading('Transcribing via Gemini 2.5 Flash Lite…');
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob);
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const json = await res.json() as { transcript?: string; model?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
      toast.success('Transcribed', {
        id: toastId,
        description: `via ${json.model}`,
        duration: 3000,
      });
      return json.transcript ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Transcription failed', {
        id: toastId,
        description: msg,
      });
      return '';
    }
  }, []);

  if (isGenerating) {
    return (
      <div className="ml-auto">
        <PromptInputSubmit onStop={onStop} status={status} />
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <SpeechInput
        size="icon"
        variant="ghost"
        className="size-8"
        lang={typeof navigator !== 'undefined' ? navigator.language : 'en-US'}
        onTranscriptionChange={handleTranscription}
        onAudioRecorded={handleAudioRecorded}
        onListeningChange={setIsDictating}
      />
      {isEmpty && !isDictating ? (
        <button
          type="button"
          title="Voice conversation"
          onClick={onOpenVoice}
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${
            voiceOpen
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <AudioLinesIcon className="size-4" />
        </button>
      ) : (
        <PromptInputSubmit onStop={onStop} status={status} />
      )}
    </div>
  );
};

// ── ChatComposer ───────────────────────────────────────────────────────────────

type ChatComposerProps = {
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
  onStop,
  onModelSelectorOpenChange,
  onSelectModel,
  onToggleWebSearch,
  onSuggestionClick,
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

  const {
    voiceState,
    transcript,
    micLevel,
    speakAloud,
    connect,
    disconnect,
    toggleSpeakAloud,
  } = useLiveVoice({
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
      <PromptInput onSubmit={(message) => onSubmit(message)} >
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
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            {!compareMode && (
              <AgentSelector
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={onSelectAgent}
              />
            )}
            {!compareMode && (
              <PromptInputButton
                onClick={onToggleWebSearch}
                variant={useWebSearch ? 'default' : 'ghost'}
              >
                <GlobeIcon className="size-4" />
                <span>Search</span>
              </PromptInputButton>
            )}
            {!compareMode && (
              <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
                <ModelSelectorTrigger asChild>
                  <PromptInputButton>
                    <ModelSelectorLogo provider={currentModel.provider} />
                    <ModelSelectorName>{currentModel.name}</ModelSelectorName>
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {selectorModels.map((model) => (
                      <ModelSelectorItem
                        key={model.id}
                        onSelect={() => onSelectModel(model.id)}
                        value={model.id}
                      >
                        <ModelSelectorLogo provider={model.provider} />
                        <ModelSelectorName>{model.name}</ModelSelectorName>
                        {selectedModel === model.id ? (
                          <CheckIcon className="ml-auto size-4" />
                        ) : null}
                      </ModelSelectorItem>
                    ))}
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
      {error ? (
        <p className="mt-2 text-xs text-destructive">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
      ) : null}
    </div>
  );
}
