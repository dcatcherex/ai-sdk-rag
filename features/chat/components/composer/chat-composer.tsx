'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { BookOpenIcon, CheckIcon, Columns2Icon, GlobeIcon, ImageIcon, LibraryIcon } from 'lucide-react';
import { useLiveVoice, type VoiceHistoryTurn, type VoiceState } from '@/features/chat/hooks/use-live-voice';
import { AiModeSelector } from './ai-mode-selector';
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
  usePromptInputController,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { CompareModelPicker } from './compare-model-picker';
import { ComposerActionButtons } from './composer-action-buttons';
import { Dots, speedTier, costTier } from './model-dots';
import { PromptPickerModal } from '@/features/prompts/components/prompt-picker-modal';
import type { ChatReferenceImage } from '@/features/chat/types';

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

const ComposerReferenceImages = ({
  referenceImages,
  onRemove,
}: {
  referenceImages: ChatReferenceImage[];
  onRemove: (id: string) => void;
}) => {
  if (referenceImages.length === 0) return null;

  return (
    <Attachments variant="inline">
      {referenceImages.map((image) => (
        <Attachment
          data={{
            id: image.id,
            type: 'file',
            url: image.thumbnailUrl ?? image.url,
            mediaType: image.mediaType,
            filename: image.filename ?? 'Reference image',
          }}
          key={image.id}
          onRemove={() => onRemove(image.id)}
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
  queuedMessageCount?: number;
  selectorModels: { id: string; name: string; provider: string }[];
  currentModel: { name: string; provider: string };
  modelSelectorOpen: boolean;
  useWebSearch: boolean;
  agents: Agent[];
  essentials: Agent[];
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
  selectedVoice?: string | null;
  referenceImages: ChatReferenceImage[];
  onRemoveReferenceImage: (id: string) => void;
  // Compare mode
  compareMode: boolean;
  comparePresetIds: string[];
  comparePresetMode: ComparePresetMode;
  onToggleCompareMode: () => void;
  onToggleCompareModel: (modelId: string) => void;
  onClearComparePreset: () => void;
  preparedPrompt?: string | null;
  onPreparedPromptApplied?: () => void;
};

// ── Prompt picker menu item (must live inside PromptInputProvider) ────────────

const PromptPickerMenuItem = () => {
  const [open, setOpen] = useState(false);
  const controller = usePromptInputController();

  return (
    <>
      <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
        <LibraryIcon className="mr-2 size-4" />
        Prompt library
      </PromptInputActionMenuItem>
      <PromptPickerModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(text) => {
          controller.textInput.setInput(text);
          setOpen(false);
        }}
      />
    </>
  );
};

// ── Voice inline display (replaces textarea when voice mode is active) ────────

const VOICE_STATUS_DOT: Record<VoiceState, string> = {
  idle: 'bg-zinc-400',
  connecting: 'bg-yellow-400 animate-pulse',
  listening: 'bg-green-500 animate-pulse',
  'ai-speaking': 'bg-blue-400 animate-pulse',
  error: 'bg-red-500',
};

const VOICE_STATUS_TEXT: Record<VoiceState, string> = {
  idle: 'Initializing...',
  connecting: 'Connecting...',
  listening: 'Listening',
  'ai-speaking': 'AI is responding...',
  error: 'Connection error',
};

const VoiceWaveformBars = ({ level, active }: { level: number; active: boolean }) => {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4, 0.6, 0.9, 0.6, 0.3, 0.8];
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {bars.map((base, i) => {
        const animating = active && level > 0.05;
        const height = animating
          ? Math.max(4, Math.round(base * level * 32))
          : active
            ? 4
            : Math.round(base * 12);
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

const VoiceInlineDisplay = ({ voiceState, micLevel }: { voiceState: VoiceState; micLevel: number }) => {
  const isListening = voiceState === 'listening';
  const isAiSpeaking = voiceState === 'ai-speaking';
  const isActive = isListening || isAiSpeaking;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-2 min-h-[52px]">
      <VoiceWaveformBars level={isListening ? micLevel : isAiSpeaking ? 0.6 : 0} active={isActive} />
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${VOICE_STATUS_DOT[voiceState]}`} />
        <span className="text-xs text-muted-foreground">{VOICE_STATUS_TEXT[voiceState]}</span>
      </div>
    </div>
  );
};

const PreparedPromptBridge = ({
  preparedPrompt,
  onApplied,
  textareaRef,
}: {
  preparedPrompt?: string | null;
  onApplied?: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) => {
  const controller = usePromptInputController();

  useEffect(() => {
    if (!preparedPrompt) return;
    controller.textInput.setInput(preparedPrompt);
    textareaRef.current?.focus();
    const nextCursor = preparedPrompt.length;
    textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    onApplied?.();
  }, [controller, onApplied, preparedPrompt, textareaRef]);

  return null;
};

// ── ChatComposer ──────────────────────────────────────────────────────────────

export function ChatComposer({
  selectedDocCount,
  status,
  error,
  selectedModel,
  queuedMessageCount = 0,
  selectorModels,
  currentModel,
  modelSelectorOpen,
  useWebSearch,
  agents,
  essentials,
  selectedAgentId,
  onSelectAgent,
  onStop,
  onModelSelectorOpenChange,
  onSelectModel,
  onToggleWebSearch,
  onTranscriptionChange,
  onSubmit,
  onVoiceTurnComplete,
  voiceHistory,
  selectedVoice,
  referenceImages,
  onRemoveReferenceImage,
  compareMode,
  comparePresetIds,
  comparePresetMode,
  onToggleCompareMode,
  onToggleCompareModel,
  onClearComparePreset,
  preparedPrompt,
  onPreparedPromptApplied,
}: ChatComposerProps) {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { voiceState, transcript, micLevel, speakAloud, disconnect, toggleSpeakAloud } =
    useLiveVoice({
      enabled: voiceOpen,
      voiceName: selectedVoice ?? undefined,
      onError: (msg) => toast.error('Voice error', { description: msg }),
      onTurnComplete: onVoiceTurnComplete,
      history: voiceHistory,
    });

  const handleOpenVoice = useCallback(() => {
    setVoiceOpen(true);
  }, []);

  const handleCloseVoice = useCallback(() => {
    disconnect();
    setVoiceOpen(false);
  }, [disconnect]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    dragCounter.current = 0;
    setIsDragOver(false);
    // Actual file handling is done by PromptInput's globalDrop handler
  }, []);

  return (
    <div
      className="relative  px-3 py-2 md:px-3 md:py-2.5 "
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 m-2 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 backdrop-blur-[2px]">
          <ImageIcon className="size-6 text-primary/70" />
          <p className="text-sm font-medium text-primary/80">Drop to attach</p>
        </div>
      )}
      {selectedDocCount > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-primary">
          <BookOpenIcon className="size-3.5" />
          <span className="font-medium">
            Answering from {selectedDocCount} selected document
            {selectedDocCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      <PromptInputProvider>
        <PromptInput globalDrop className="rounded-xl" onSubmit={(message) => onSubmit(message)}>
          <PreparedPromptBridge
            preparedPrompt={preparedPrompt}
            onApplied={onPreparedPromptApplied}
            textareaRef={textareaRef}
          />
          <PromptInputHeader>
            <ComposerAttachments />
            <ComposerReferenceImages
              referenceImages={referenceImages}
              onRemove={onRemoveReferenceImage}
            />
          </PromptInputHeader>
          <PromptInputBody>
            {voiceOpen ? (
              <VoiceInlineDisplay voiceState={voiceState} micLevel={micLevel} />
            ) : (
              <PromptInputTextarea
                ref={textareaRef}
                className="min-h-9 max-h-[40vh] overflow-y-auto leading-6 px-3 pt-2.5 pb-2"
                placeholder={
                  compareMode
                    ? 'พิมพ์คำสั่งเพื่อเทียบคำตอบจากหลายโมเดล'
                    : 'อยากให้ Vaja ช่วยอะไร?'
                }
              />
            )}
          </PromptInputBody>
          <PromptInputFooter className="py-2 px-2">
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptPickerMenuItem />
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
                  <PromptInputActionMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onToggleCompareMode();
                    }}
                  >
                    <Columns2Icon className="mr-2 size-4" />
                    Compare models
                    {compareMode && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                  </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              {!compareMode && (
                <AiModeSelector
                  agents={agents}
                  essentials={essentials}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={onSelectAgent}
                />
              )}
              {!compareMode && (
                <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton aria-label="Select model" title="Select model">
                      <ModelSelectorLogo provider={currentModel.provider} />
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <div className="flex items-center px-3 py-1.5 border-b border-black/5 dark:border-border">
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
                        const isSelected = selectedModel === model.id;
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
                              {isSelected && (
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
              {compareMode && (
                <div className="flex items-center rounded-md bg-primary text-primary-foreground">
                  <button
                    type="button"
                    onClick={onToggleCompareMode}
                    title="Cancel compare"
                    className="flex h-8 items-center gap-1.5 rounded-l-md px-2.5 text-[13px] font-medium text-primary-foreground hover:bg-white/15 transition-colors"
                  >
                    <Columns2Icon className="size-4" />
                    {comparePresetIds.length > 0 && (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                        {comparePresetIds.length}
                      </span>
                    )}
                  </button>
                  <div className="w-px self-stretch bg-white/20" />
                  <CompareModelPicker
                    hideToggle
                    compareMode={compareMode}
                    comparePresetIds={comparePresetIds}
                    comparePresetMode={comparePresetMode}
                    selectorModels={selectorModels}
                    onToggleCompareMode={onToggleCompareMode}
                    onToggleCompareModel={onToggleCompareModel}
                    onClearComparePreset={onClearComparePreset}
                  />
                </div>
              )}
            </PromptInputTools>
            <ComposerActionButtons
              status={status}
              queuedMessageCount={queuedMessageCount}
              voiceOpen={voiceOpen}
              voiceState={voiceState}
              speakAloud={speakAloud}
              onStop={onStop}
              onOpenVoice={handleOpenVoice}
              onCloseVoice={handleCloseVoice}
              onToggleSpeakAloud={toggleSpeakAloud}
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
