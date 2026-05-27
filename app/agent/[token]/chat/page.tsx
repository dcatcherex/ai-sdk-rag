'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowLeftIcon, AudioLinesIcon, CheckIcon, CopyIcon, ImageIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { ChatStatus } from 'ai';
import { cn } from '@/lib/utils';
import { MessagePartRenderer } from '@/components/message-renderer';
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
  PromptInputActionMenuTrigger,
  PromptInputBody,
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
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { AgentChatEmptyState } from '@/features/chat/components/empty-state/agent-chat-empty-state';
import type { AgentStarterTask } from '@/features/chat/components/empty-state/types';
import { Button } from '@/components/ui/button';
import { filterRenderableMessageParts } from '@/features/chat/utils/message-parts';
import { useLiveVoice, type VoiceHistoryTurn, type VoiceState } from '@/features/chat/hooks/use-live-voice';
import type { ChatMessage, ChatMessageMetadata, ChatMessagePart, VoiceTurnMetadata } from '@/features/chat/types';

type AgentMeta = {
  name: string;
  description: string | null;
  imageUrl: string | null;
  starterTasks: AgentStarterTask[];
};
type ShareMeta = { welcomeMessage: string | null };

const SESSION_KEY = (token: string) => `guest-session-${token}`;
const SESSION_ID_KEY = (token: string) => `guest-sid-${token}`;
const GUEST_ID_KEY = (token: string) => `guest-id-${token}`;
const FOLLOW_UP_SYNC_RETRY_DELAY_MS = 500;
const FOLLOW_UP_SYNC_MAX_ATTEMPTS = 15;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getOrCreateGuestId(token: string): string {
  let id = localStorage.getItem(GUEST_ID_KEY(token));
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY(token), id);
  }
  return id;
}

// ── Composer pieces ──────────────────────────────────────────────────────────

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

const GUEST_VOICE_STATUS_DOT: Record<VoiceState, string> = {
  idle: 'bg-zinc-400',
  connecting: 'bg-yellow-400 animate-pulse',
  listening: 'bg-green-500 animate-pulse',
  'ai-speaking': 'bg-blue-400 animate-pulse',
  error: 'bg-red-500',
};

const GUEST_VOICE_STATUS_TEXT: Record<VoiceState, string> = {
  idle: 'Initializing...',
  connecting: 'Connecting...',
  listening: 'Listening',
  'ai-speaking': 'AI is responding...',
  error: 'Connection error',
};

const GuestVoiceInlineDisplay = ({ voiceState, micLevel }: { voiceState: VoiceState; micLevel: number }) => {
  const bars = [0.4, 0.7, 1, 0.65, 0.35, 0.82, 0.55, 0.9, 0.45, 0.72];
  const isActive = voiceState === 'listening' || voiceState === 'ai-speaking';
  const level = voiceState === 'listening' ? Math.max(0.12, micLevel) : voiceState === 'ai-speaking' ? 0.6 : 0.22;

  return (
    <div className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-4 py-2">
      <div className="flex h-8 items-center justify-center gap-[3px]">
        {bars.map((base, index) => (
          <span
            key={index}
            className={cn(
              'w-1 rounded-full transition-all duration-100',
              isActive ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
            style={{ height: Math.max(4, Math.round(base * level * 32)) }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', GUEST_VOICE_STATUS_DOT[voiceState])} />
        <span className="text-xs text-muted-foreground">{GUEST_VOICE_STATUS_TEXT[voiceState]}</span>
      </div>
    </div>
  );
};

const GuestActionButtons = ({
  status,
  voiceOpen,
  voiceState,
  speakAloud,
  onStop,
  onOpenVoice,
  onCloseVoice,
  onToggleSpeakAloud,
  onTranscriptionChange,
}: {
  status: ChatStatus;
  voiceOpen: boolean;
  voiceState: VoiceState;
  speakAloud: boolean;
  onStop: () => void;
  onOpenVoice: () => void;
  onCloseVoice: () => void;
  onToggleSpeakAloud: () => void;
  onTranscriptionChange: (t: string) => void;
}) => {
  const { textInput } = usePromptInputController();
  const { anyUploading } = usePromptInputAttachments();
  const [isDictating, setIsDictating] = useState(false);
  const isEmpty = textInput.value.trim() === '';
  const isGenerating = status === 'submitted' || status === 'streaming';

  const textInputRef = useRef(textInput);
  textInputRef.current = textInput;

  const handleTranscription = useCallback((transcript: string) => {
    const current = textInputRef.current.value;
    const next = current ? `${current} ${transcript}` : transcript;
    textInputRef.current.setInput(next);
    onTranscriptionChange(next);
  }, [onTranscriptionChange]);

  const handleAudioRecorded = useCallback(async (audioBlob: Blob): Promise<string> => {
    const toastId = toast.loading('Transcribing…');
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob);
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const json = await res.json() as { transcript?: string; model?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
      toast.success('Transcribed', { id: toastId, description: `via ${json.model}`, duration: 3000 });
      return json.transcript ?? '';
    } catch (err) {
      toast.error('Transcription failed', { id: toastId, description: err instanceof Error ? err.message : 'Unknown error' });
      return '';
    }
  }, []);

  if (isGenerating) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <PromptInputSubmit className="size-9 rounded-full" onStop={onStop} status={status} />
      </div>
    );
  }

  if (voiceOpen) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2" data-voice-state={voiceState}>
        <button
          type="button"
          title={speakAloud ? 'Mute AI voice' : 'Unmute AI voice'}
          aria-label={speakAloud ? 'Mute AI voice' : 'Unmute AI voice'}
          onClick={onToggleSpeakAloud}
          className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-muted-foreground transition-colors hover:bg-slate-200 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15"
        >
          {speakAloud ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
        </button>
        <button
          type="button"
          title="End voice conversation"
          aria-label="End voice conversation"
          onClick={onCloseVoice}
          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <AudioLinesIcon className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('ml-auto flex shrink-0 items-center gap-1.5', isDictating && 'flex-1')}>
      <SpeechInput
        size="icon"
        variant="ghost"
        className="size-9 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
        lang={typeof navigator !== 'undefined' ? navigator.language : 'th-TH'}
        onTranscriptionChange={handleTranscription}
        onAudioRecorded={handleAudioRecorded}
        onListeningChange={setIsDictating}
      />
      {!isDictating && (isEmpty ? (
        <button
          type="button"
          title="Talk with Vaja"
          aria-label="Talk with Vaja"
          onClick={onOpenVoice}
          className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <AudioLinesIcon className="size-4" />
        </button>
      ) : (
        <PromptInputSubmit
          className="size-9 rounded-full shadow-sm"
          onStop={onStop}
          status={status}
          disabled={anyUploading || undefined}
        />
      ))}
    </div>
  );
};

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuestChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [agentMeta, setAgentMeta] = useState<AgentMeta | null>(null);
  const [shareMeta, setShareMeta] = useState<ShareMeta | null>(null);
  const [preparedPrompt, setPreparedPrompt] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agent/${token}`)
      .then((r) => r.ok ? r.json() as Promise<{ agent: AgentMeta; share: ShareMeta }> : null)
      .then((d) => { if (d) { setAgentMeta(d.agent); setShareMeta(d.share); } });
  }, [token]);

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: `/api/agent/${token}/chat`,
      headers: () => {
        const guestId = getOrCreateGuestId(token);
        const sessionToken = sessionStorage.getItem(SESSION_KEY(token)) ?? '';
        let sessionId = sessionStorage.getItem(SESSION_ID_KEY(token));
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem(SESSION_ID_KEY(token), sessionId);
        }
        const h: Record<string, string> = { 'x-session-id': sessionId, 'x-guest-id': guestId };
        if (sessionToken) h['x-guest-token'] = sessionToken;
        return h;
      },
    }),
    [token],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({ transport });

  const fetchThreadMessages = useCallback(async () => {
    const guestId = getOrCreateGuestId(token);
    const response = await fetch(`/api/agent/${token}/thread`, {
      headers: { 'x-guest-id': guestId },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Failed to load guest thread messages');
    }
    return response.json() as Promise<{ threadId: string | null; messages: ChatMessage[] }>;
  }, [token]);

  const realtimeHeaders = useCallback(() => {
    const guestId = getOrCreateGuestId(token);
    const sessionToken = sessionStorage.getItem(SESSION_KEY(token)) ?? '';
    return {
      'x-guest-id': guestId,
      ...(sessionToken ? { 'x-guest-token': sessionToken } : {}),
    };
  }, [token]);

  const ensureGuestThread = useCallback(async () => {
    if (currentThreadId) {
      return currentThreadId;
    }

    const response = await fetch(`/api/agent/${token}/thread`, {
      method: 'POST',
      headers: realtimeHeaders(),
      cache: 'no-store',
    });
    const payload = await response.json() as { threadId?: string; error?: string };
    if (!response.ok || !payload.threadId) {
      throw new Error(payload.error ?? 'Unable to start voice chat.');
    }
    setCurrentThreadId(payload.threadId);
    return payload.threadId;
  }, [currentThreadId, realtimeHeaders, token]);

  useEffect(() => {
    fetchThreadMessages()
      .then((data) => data ?? null)
      .then((data) => {
        if (data?.threadId) setCurrentThreadId(data.threadId);
        if (data?.messages?.length > 0) setMessages(data.messages);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchThreadMessages, token]);

  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) {
      return;
    }

    let cancelled = false;

    const syncFinalizedMessages = async () => {
      for (let attempt = 0; attempt < FOLLOW_UP_SYNC_MAX_ATTEMPTS; attempt += 1) {
        try {
          const payload = await fetchThreadMessages();
          if (cancelled || !payload.messages?.length) {
            return;
          }
          if (payload.threadId) {
            setCurrentThreadId(payload.threadId);
          }

          const lastDbAssistant = [...payload.messages].reverse().find((message) => message.role === 'assistant');
          const hasDbRichMessage = Boolean(
            lastDbAssistant?.parts?.some((part) => part.type === 'data-rich-message'),
          );
          const hasDbFollowUps = Boolean(
            (lastDbAssistant?.metadata as ChatMessageMetadata | undefined)?.followUpSuggestions?.length,
          );

          if (hasDbRichMessage || hasDbFollowUps) {
            setMessages(payload.messages);
            return;
          }
        } catch {
          // retry below
        }

        if (attempt < FOLLOW_UP_SYNC_MAX_ATTEMPTS - 1) {
          await delay(FOLLOW_UP_SYNC_RETRY_DELAY_MS);
        }
      }
    };

    void syncFinalizedMessages();

    return () => {
      cancelled = true;
    };
  }, [fetchThreadMessages, messages.length, setMessages, status]);

  const isLoading = status === 'streaming' || status === 'submitted';

  const voiceHistory = useMemo<VoiceHistoryTurn[]>(() => {
    return messages
      .map((message) => {
        const text = (message.parts as ChatMessagePart[])
          .filter((part): part is Extract<ChatMessagePart, { type: 'text' }> => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
          .trim();

        if (!text || (message.role !== 'user' && message.role !== 'assistant')) {
          return null;
        }

        return { role: message.role, text };
      })
      .filter((turn): turn is VoiceHistoryTurn => turn !== null)
      .slice(-12);
  }, [messages]);

  const getRealtimeVoiceContext = useCallback(async () => ({
    threadId: await ensureGuestThread(),
  }), [ensureGuestThread]);

  const handleVoiceTurnComplete = useCallback(async (
    userText: string,
    aiText: string,
    metadata?: VoiceTurnMetadata,
  ) => {
    const threadId = await ensureGuestThread();
    const response = await fetch(`/api/agent/${token}/voice-turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...realtimeHeaders() },
      body: JSON.stringify({ threadId, userText, aiText, metadata }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to save voice turn.');
    }
    const refreshed = await fetchThreadMessages();
    if (refreshed.threadId) setCurrentThreadId(refreshed.threadId);
    if (refreshed.messages?.length) setMessages(refreshed.messages);
  }, [ensureGuestThread, fetchThreadMessages, realtimeHeaders, setMessages, token]);

  const { voiceState, micLevel, speakAloud, disconnect, toggleSpeakAloud } = useLiveVoice({
    enabled: voiceOpen,
    sessionEndpoint: `/api/agent/${token}/realtime/session`,
    toolCallEndpoint: `/api/agent/${token}/realtime/tool-call`,
    realtimeHeaders,
    onError: (message) => toast.error('Voice error', { description: message }),
    onTurnComplete: handleVoiceTurnComplete,
    history: voiceHistory,
    getRealtimeContext: getRealtimeVoiceContext,
  });

  const handleOpenVoice = useCallback(() => setVoiceOpen(true), []);
  const handleCloseVoice = useCallback(() => {
    disconnect();
    setVoiceOpen(false);
  }, [disconnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(({ text, files }: PromptInputMessage) => {
    if ((!text.trim() && files.length === 0) || isLoading) return;
    type Part = { type: 'text'; text: string } | { type: 'file'; url: string; mediaType: string; filename?: string };
    const parts: Part[] = [];
    if (text.trim()) parts.push({ type: 'text', text: text.trim() });
    for (const f of files) parts.push({ type: 'file', url: f.url, mediaType: f.mediaType, filename: f.filename });
    sendMessage({ parts } as Parameters<typeof sendMessage>[0]);
  }, [isLoading, sendMessage]);

  const handleTaskSelect = useCallback((task: AgentStarterTask) => {
    setPreparedPrompt(task.prompt);
  }, []);

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
  const handleDrop = useCallback(() => { dragCounter.current = 0; setIsDragOver(false); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-0 py-0 md:px-4 md:py-5">
      <div className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden border border-border bg-background md:h-[calc(100vh-2.5rem)] md:rounded-[28px] md:shadow-[0_28px_70px_-48px_rgba(31,41,55,0.3)] dark:md:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.75)]">

        {/* Header — back button + agent name only */}
        <header className="flex items-center gap-2 border-b border-black/5 dark:border-white/8 px-3 py-2.5 shrink-0">
          <Link href={`/agent/${token}`}>
            <Button variant="ghost" size="icon" className="size-8 rounded-lg shrink-0">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <p className="text-sm font-semibold truncate">{agentMeta?.name ?? '…'}</p>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <AgentChatEmptyState
              agentName={agentMeta?.name}
              agentDescription={agentMeta?.description}
              agentImageUrl={agentMeta?.imageUrl}
              starterTasks={agentMeta?.starterTasks}
              onSelectTask={handleTaskSelect}
            />
          ) : (
            <div className="px-4 py-6 space-y-5 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-[80%]`}>
                    {msg.role === 'user' ? (
                      <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {filterRenderableMessageParts(msg.parts as ChatMessagePart[]).map((part, i) => (
                          <MessagePartRenderer
                            key={`${msg.id}-${i}`}
                            part={part}
                            messageId={msg.id}
                            index={i}
                            role={msg.role}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filterRenderableMessageParts(msg.parts as ChatMessagePart[]).map((part, i) => (
                          part.type === 'text' ? (
                            <div
                              key={`${msg.id}-${i}`}
                              className="rounded-2xl rounded-tl-sm border border-black/5 bg-muted/40 px-4 py-2.5 text-sm dark:border-white/8"
                            >
                              <MessagePartRenderer
                                part={part}
                                messageId={msg.id}
                                index={i}
                                role={msg.role}
                              />
                            </div>
                          ) : (
                            <MessagePartRenderer
                              key={`${msg.id}-${i}`}
                              part={part}
                              messageId={msg.id}
                              index={i}
                              role={msg.role}
                            />
                          )
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="mt-1 flex items-center gap-0.5 pl-1">
                        <CopyButton
                          text={msg.parts.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text).join('\n')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-muted/40 border border-black/5 dark:border-white/8 px-4 py-3">
                    <span className="flex gap-1">
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer — same styling as ChatComposer, with speech input */}
        <div
          className="relative px-3 pb-3 pt-1 shrink-0 md:px-6 md:pb-4"
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
          <PromptInputProvider>
            <PreparedPromptBridge
              preparedPrompt={preparedPrompt}
              onApplied={() => setPreparedPrompt(null)}
            />
            <PromptInput
              globalDrop
              accept="image/*,application/pdf"
              multiple
              className="rounded-[22px] [&_[data-slot=input-group]]:rounded-[22px] [&_[data-slot=input-group]]:border-black/8 [&_[data-slot=input-group]]:bg-white/86 [&_[data-slot=input-group]]:shadow-[0_18px_55px_-36px_rgba(15,23,42,0.75)] [&_[data-slot=input-group]]:backdrop-blur dark:[&_[data-slot=input-group]]:border-white/12 dark:[&_[data-slot=input-group]]:bg-white/[0.06]"
              onSubmit={handleSubmit}
            >
              <PromptInputHeader>
                <ComposerAttachments />
              </PromptInputHeader>
              <PromptInputBody>
                {voiceOpen ? (
                  <GuestVoiceInlineDisplay voiceState={voiceState} micLevel={micLevel} />
                ) : (
                  <PromptInputTextarea
                    placeholder="อยากให้ Vaja ช่วยอะไร?"
                    className="flex-1 self-stretch resize-none rounded-none border-0 bg-transparent shadow-none max-h-[40vh] overflow-y-auto px-4 pb-2 pt-1 text-sm leading-6 font-light outline-none text-left"
                    disabled={isLoading}
                  />
                )}
              </PromptInputBody>
              <PromptInputFooter className="px-2.5 pb-2.5 pt-1">
                <PromptInputTools className="min-w-0 flex-1 gap-1.5 overflow-hidden">
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger
                      className="size-9 shrink-0 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                      title="Add files"
                      aria-label="Add files"
                    />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                </PromptInputTools>
                <GuestActionButtons
                  status={status}
                  voiceOpen={voiceOpen}
                  voiceState={voiceState}
                  speakAloud={speakAloud}
                  onStop={stop}
                  onOpenVoice={handleOpenVoice}
                  onCloseVoice={handleCloseVoice}
                  onToggleSpeakAloud={toggleSpeakAloud}
                  onTranscriptionChange={() => {}}
                />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputProvider>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Powered by AI · Free, no account needed
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Prepared prompt bridge (inside PromptInputProvider) ───────────────────────

function PreparedPromptBridge({
  preparedPrompt,
  onApplied,
}: {
  preparedPrompt: string | null;
  onApplied: () => void;
}) {
  const controller = usePromptInputController();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!preparedPrompt) return;
    controller.textInput.setInput(preparedPrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = preparedPrompt.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    onApplied();
  }, [controller, onApplied, preparedPrompt]);

  return null;
}
