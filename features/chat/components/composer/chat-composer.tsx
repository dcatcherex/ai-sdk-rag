'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { BookOpenIcon, CheckIcon, Columns2Icon, GlobeIcon, ImageIcon, LibraryIcon } from 'lucide-react';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { SkillWithOwner } from '@/features/skills/types';
import { useLiveVoice, type VoiceHistoryTurn, type VoiceState } from '@/features/chat/hooks/use-live-voice';
import { AiModeSelector } from './ai-mode-selector';
import { RichSkillInput, type RichInputHandle } from './rich-skill-input';
import { SlashCommandMenu } from './slash-command-menu';
import { ComposerModelSelector } from './composer-model-selector';
import type { Agent } from '@/features/agents/types';
import type { ComparePresetMode } from '@/features/chat/hooks/use-compare-preset';
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { CompareModelPicker } from './compare-model-picker';
import { ComposerActionButtons } from './composer-action-buttons';
import { PromptPickerModal } from '@/features/prompts/components/prompt-picker-modal';
import type { ChatReferenceImage, VoiceTurnMetadata } from '@/features/chat/types';

// ── Small inline helpers (require PromptInputProvider context) ────────────────

const ComposerAttachments = () => {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment data={attachment} key={attachment.id} onRemove={() => attachments.remove(attachment.id)}>
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
          data={{ id: image.id, type: 'file', url: image.thumbnailUrl ?? image.url, mediaType: image.mediaType, filename: image.filename ?? 'Reference image' }}
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

const PromptPickerMenuItem = () => {
  const [open, setOpen] = useState(false);
  const controller = usePromptInputController();
  return (
    <>
      <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
        <LibraryIcon className="mr-2 size-4" />
        Prompt library
      </PromptInputActionMenuItem>
      <PromptPickerModal open={open} onOpenChange={setOpen} onSelect={(text) => { controller.textInput.setInput(text); setOpen(false); }} />
    </>
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

// ── Voice inline display ──────────────────────────────────────────────────────

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

const VoiceInlineDisplay = ({ voiceState, micLevel }: { voiceState: VoiceState; micLevel: number }) => {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4, 0.6, 0.9, 0.6, 0.3, 0.8];
  const isListening = voiceState === 'listening';
  const isAiSpeaking = voiceState === 'ai-speaking';
  const isActive = isListening || isAiSpeaking;
  const level = isListening ? micLevel : isAiSpeaking ? 0.6 : 0;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-2 min-h-[52px]">
      <div className="flex items-center justify-center gap-[3px] h-8">
        {bars.map((base, i) => {
          const animating = isActive && level > 0.05;
          const height = animating ? Math.max(4, Math.round(base * level * 32)) : isActive ? 4 : Math.round(base * 12);
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${VOICE_STATUS_DOT[voiceState]}`} />
        <span className="text-xs text-muted-foreground">{VOICE_STATUS_TEXT[voiceState]}</span>
      </div>
    </div>
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
  onVoiceTurnComplete?: (userText: string, aiText: string, metadata?: VoiceTurnMetadata) => Promise<void>;
  getRealtimeVoiceContext?: () => Promise<{
    threadId: string;
    agentId?: string | null;
    model?: string;
    enabledModelIds?: string[];
    selectedDocumentIds?: string[];
    useWebSearch?: boolean;
  }>;
  voiceHistory?: VoiceHistoryTurn[];
  selectedVoice?: string | null;
  referenceImages: ChatReferenceImage[];
  onRemoveReferenceImage: (id: string) => void;
  compareMode: boolean;
  comparePresetIds: string[];
  comparePresetMode: ComparePresetMode;
  onToggleCompareMode: () => void;
  onToggleCompareModel: (modelId: string) => void;
  onClearComparePreset: () => void;
  preparedPrompt?: string | null;
  onPreparedPromptApplied?: () => void;
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
  getRealtimeVoiceContext,
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
  const richInputRef = useRef<RichInputHandle | null>(null);
  const { data: skillsData } = useSkills();
  const slashSkills = skillsData?.skills ?? [];

  const handleSkillSelect = useCallback((skill: SkillWithOwner) => {
    richInputRef.current?.insertBadge(skill);
  }, []);

  const { voiceState, micLevel, speakAloud, disconnect, toggleSpeakAloud } =
    useLiveVoice({
      enabled: voiceOpen,
      voiceName: selectedVoice ?? undefined,
      onError: (msg) => toast.error('Voice error', { description: msg }),
      onTurnComplete: onVoiceTurnComplete,
      history: voiceHistory,
      getRealtimeContext: getRealtimeVoiceContext,
    });

  const handleOpenVoice = useCallback(() => setVoiceOpen(true), []);
  const handleCloseVoice = useCallback(() => { disconnect(); setVoiceOpen(false); }, [disconnect]);

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

  const handleDrop = useCallback(() => {
    dragCounter.current = 0;
    setIsDragOver(false);
  }, []);

  return (
    <div
      className="relative px-3 pb-3 md:px-6 md:pb-4"
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
        <div className="mb-2 flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1.5 text-xs text-primary">
          <BookOpenIcon className="size-3.5" />
          <span className="font-medium">
            Answering from {selectedDocCount} selected document{selectedDocCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <PromptInputProvider>
        <div className="relative">
          <SlashCommandMenu skills={slashSkills} onSelect={handleSkillSelect} />
          <PromptInput
            globalDrop
            className="rounded-[22px] [&_[data-slot=input-group]]:rounded-[22px] [&_[data-slot=input-group]]:border-black/8 [&_[data-slot=input-group]]:bg-white/86 [&_[data-slot=input-group]]:shadow-[0_18px_55px_-36px_rgba(15,23,42,0.75)] [&_[data-slot=input-group]]:backdrop-blur dark:[&_[data-slot=input-group]]:border-white/12 dark:[&_[data-slot=input-group]]:bg-white/[0.06]"
            onSubmit={(message) => onSubmit(message)}
          >
            <PreparedPromptBridge preparedPrompt={preparedPrompt} onApplied={onPreparedPromptApplied} textareaRef={textareaRef} />
            <PromptInputHeader>
              <ComposerAttachments />
              <ComposerReferenceImages referenceImages={referenceImages} onRemove={onRemoveReferenceImage} />
            </PromptInputHeader>
            <PromptInputBody>
              {voiceOpen ? (
                <VoiceInlineDisplay voiceState={voiceState} micLevel={micLevel} />
              ) : (
                <RichSkillInput
                  ref={richInputRef}
                  className="flex-1 self-stretch resize-none rounded-none border-0 bg-transparent shadow-none max-h-[40vh] overflow-y-auto px-4 pb-2 pt-1 text-sm leading-6 font-light outline-none text-left"
                  placeholder={compareMode ? 'พิมพ์คำสั่งเพื่อเทียบคำตอบจากหลายโมเดล' : 'อยากให้ Vaja ช่วยอะไร?'}
                />
              )}
            </PromptInputBody>
            <PromptInputFooter className="px-2.5 pb-2.5 pt-1">
              <PromptInputTools className="min-w-0 flex-1 gap-1.5 overflow-hidden">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger
                    className="size-9 shrink-0 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                    title="Add tools or files"
                    aria-label="Add tools or files"
                  />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                    <PromptPickerMenuItem />
                    {!compareMode && (
                      <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); onToggleWebSearch(); }}>
                        <GlobeIcon className="mr-2 size-4" />
                        Web search
                        {useWebSearch && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                      </PromptInputActionMenuItem>
                    )}
                    <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); onToggleCompareMode(); }}>
                      <Columns2Icon className="mr-2 size-4" />
                      Compare models
                      {compareMode && <CheckIcon className="ml-auto size-3.5 text-primary" />}
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>

                {!compareMode && (
                  <div className="hidden md:contents">
                    <AiModeSelector
                      agents={agents}
                      essentials={essentials}
                      selectedAgentId={selectedAgentId}
                      onSelectAgent={onSelectAgent}
                      variant="minimal"
                    />
                  </div>
                )}

                {!compareMode && (
                  <ComposerModelSelector
                    open={modelSelectorOpen}
                    onOpenChange={onModelSelectorOpenChange}
                    currentModel={currentModel}
                    selectorModels={selectorModels}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                  />
                )}

                {compareMode && (
                  <div className="flex items-center rounded-md bg-primary text-primary-foreground">
                    <button
                      type="button"
                      onClick={onToggleCompareMode}
                      title="Cancel compare"
                      className="flex h-8 items-center gap-1.5 rounded-l-md px-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-white/15"
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
        </div>
      </PromptInputProvider>

      {error && (
        <p className="mt-2 text-xs text-destructive">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </div>
  );
}
