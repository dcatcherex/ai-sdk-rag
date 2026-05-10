'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef, type RefObject } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { BookOpenIcon, CheckIcon, Columns2Icon, GlobeIcon, ImageIcon, LibraryIcon, ZapIcon } from 'lucide-react';
import { useSkills } from '@/features/skills/hooks/use-skills';
import type { SkillWithOwner } from '@/features/skills/types';
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

// ── Rich text input with inline skill badges ──────────────────────────────────

/** Serialize contenteditable → plain text (badge spans → /trigger) */
function serializeRich(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof HTMLElement) {
      const trigger = node.dataset.skillTrigger;
      if (trigger) {
        text += `/${trigger}`;
      } else if (node.tagName === 'BR') {
        text += '\n';
      } else {
        const inner = serializeRich(node);
        text += inner;
        if (node.tagName === 'DIV' && inner) text += '\n';
      }
    }
  });
  return text;
}

/** Create an inline non-editable badge DOM element for a skill */
function createSkillBadgeNode(skill: SkillWithOwner): HTMLSpanElement {
  const trigger = skill.trigger!.startsWith('/') ? skill.trigger!.slice(1) : skill.trigger!;
  const el = document.createElement('span');
  el.contentEditable = 'false';
  el.dataset.skillTrigger = trigger;
  el.dataset.skillId = skill.id;
  el.className = 'inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-light mx-0.5 align-middle select-none';
  const labelText = document.createTextNode(skill.name);
  const labelSpan = document.createElement('span');
  labelSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px';
  labelSpan.appendChild(labelText);
  el.title = `/${trigger}`;
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  el.appendChild(labelSpan);
  return el;
}

/** Find the /token at or before cursor and replace it with a badge. Returns false if no slash token found. */
function insertSkillBadge(el: HTMLElement, skill: SkillWithOwner): boolean {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || !el.contains(range.startContainer)) return false;

  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) return false;

  const text = textNode.textContent ?? '';
  const cursorPos = range.startOffset;
  const before = text.slice(0, cursorPos);

  // Find last '/' with no space between it and cursor
  const slashIdx = before.lastIndexOf('/');
  if (slashIdx === -1 || before.slice(slashIdx).includes(' ')) return false;

  // Delete the /token text
  const replaceRange = document.createRange();
  replaceRange.setStart(textNode, slashIdx);
  replaceRange.setEnd(textNode, cursorPos);
  replaceRange.deleteContents();

  // Insert badge
  const badge = createSkillBadgeNode(skill);
  replaceRange.insertNode(badge);

  // Place cursor after badge
  const after = document.createRange();
  after.setStartAfter(badge);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}

type RichInputHandle = { insertBadge: (skill: SkillWithOwner) => void };

/** Contenteditable div that syncs to PromptInputController and supports inline skill badges */
const RichSkillInput = forwardRef<RichInputHandle, {
  className?: string;
  placeholder?: string;
}>(({ className, placeholder }, fwdRef) => {
  const controller = usePromptInputController();
  const attachments = usePromptInputAttachments();
  const divRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const lastSerialized = useRef('');

  // Sync externally-set controller value into the contenteditable (e.g. PreparedPromptBridge)
  useEffect(() => {
    const val = controller.textInput.value;
    if (val === lastSerialized.current) return;
    if (!divRef.current) return;
    lastSerialized.current = val;
    // Replace DOM content with plain text (clears badges on external reset)
    divRef.current.textContent = val;
    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(divRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [controller.textInput.value]);

  const handleInsertBadge = useCallback((skill: SkillWithOwner) => {
    if (!divRef.current) return;
    const ok = insertSkillBadge(divRef.current, skill);
    if (!ok) return;
    const text = serializeRich(divRef.current);
    lastSerialized.current = text;
    controller.textInput.setInput(text);
    divRef.current.focus();
  }, [controller]);

  useImperativeHandle(fwdRef, () => ({ insertBadge: handleInsertBadge }), [handleInsertBadge]);

  const handleInput = useCallback(() => {
    if (!divRef.current) return;
    const text = serializeRich(divRef.current);
    lastSerialized.current = text;
    controller.textInput.setInput(text);
  }, [controller]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing.current) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      divRef.current?.closest('form')?.requestSubmit();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = Array.from(items).flatMap((item) => {
      if (item.kind !== 'file') return [];
      const f = item.getAsFile();
      return f ? [f] : [];
    });
    if (files.length > 0) {
      e.preventDefault();
      attachments.add(files);
    } else {
      // Strip HTML — paste plain text only
      e.preventDefault();
      const plain = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, plain);
    }
  }, [attachments]);

  return (
    <div
      ref={divRef}
      data-slot="input-group-control"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={className}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
      onPaste={handlePaste}
    />
  );
});
RichSkillInput.displayName = 'RichSkillInput';

// ── Slash command dropdown ─────────────────────────────────────────────────────

function getSlashQuery(input: string): string | null {
  // Find the last slash token that is still being typed (no space after it)
  const match = input.match(/(?:^|[\s฀-๿])\/([\S]*)$/);
  if (!match) return null;
  return match[1]!.toLowerCase();
}

/** Floating command list — appears while the user is typing a /command */
const SlashCommandMenu = ({ skills, onSelect }: { skills: SkillWithOwner[]; onSelect: (skill: SkillWithOwner) => void }) => {
  const controller = usePromptInputController();
  const input = controller.textInput.value;
  const [activeIndex, setActiveIndex] = useState(0);

  const query = getSlashQuery(input);
  const slashSkills = skills.filter((s) => s.triggerType === 'slash' && s.trigger);

  const filtered = query === null ? [] : slashSkills.filter((s) => {
    const t = (s.trigger!.startsWith('/') ? s.trigger!.slice(1) : s.trigger!).toLowerCase();
    return t.startsWith(query);
  });

  const isOpen = query !== null;

  useEffect(() => { setActiveIndex(0); }, [filtered.length]);

  const select = useCallback((skill: SkillWithOwner) => {
    onSelect(skill);
  }, [onSelect]);

  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); select(filtered[activeIndex]!); }
      else if (e.key === 'Escape') { e.preventDefault(); controller.textInput.setInput(''); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, filtered, activeIndex, select, controller]);

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-black/8 bg-white/95 shadow-lg backdrop-blur dark:border-white/12 dark:bg-zinc-900/95">
      {filtered.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          No slash commands found. Add a slash trigger to a skill to use it here.
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.map((skill, i) => {
            const sourceTag = skill.userId === null ? 'System' : skill.isPublic ? 'Team' : 'Personal';
            return (
              <button
                key={skill.id}
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === activeIndex ? 'bg-primary/8' : 'hover:bg-muted/50'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(skill)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <ZapIcon className="size-3 text-primary" />
                </span>
                <span className="min-w-0 flex-1 flex items-baseline gap-2 overflow-hidden">
                  <span className="shrink-0 text-sm font-medium text-foreground">{skill.name}</span>
                  {skill.description && (
                    <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/60">{sourceTag}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const richInputRef = useRef<RichInputHandle | null>(null);
  const { data: skillsData } = useSkills();
  const slashSkills = skillsData?.skills ?? [];

  const handleSkillSelect = useCallback((skill: SkillWithOwner) => {
    richInputRef.current?.insertBadge(skill);
  }, []);

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
            Answering from {selectedDocCount} selected document
            {selectedDocCount !== 1 ? 's' : ''}
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
              <RichSkillInput
                ref={richInputRef}
                className="flex-1 self-stretch resize-none rounded-none border-0 bg-transparent shadow-none max-h-[40vh] overflow-y-auto px-4 pb-2 pt-1 text-sm leading-6 font-light outline-none text-left"
                placeholder={
                  compareMode
                    ? 'พิมพ์คำสั่งเพื่อเทียบคำตอบจากหลายโมเดล'
                    : 'อยากให้ Vaja ช่วยอะไร?'
                }
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
                    <PromptInputButton
                      aria-label="Select model"
                      title="Select model"
                      className="size-9 shrink-0 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                    >
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
