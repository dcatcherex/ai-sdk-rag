'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { FileUIPart } from 'ai';
import { ArrowLeftIcon, CheckIcon, CopyIcon, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { ChatStatus } from 'ai';
import { cn } from '@/lib/utils';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
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

const GuestActionButtons = ({
  status,
  onStop,
  onTranscriptionChange,
}: {
  status: ChatStatus;
  onStop: () => void;
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
      {!isDictating && !isEmpty && (
        <PromptInputSubmit
          className="size-9 rounded-full shadow-sm"
          onStop={onStop}
          status={status}
          disabled={anyUploading || undefined}
        />
      )}
    </div>
  );
};

// ── File thumbnail in user bubble ─────────────────────────────────────────────

function FilePart({ part }: { part: FileUIPart }) {
  if (part.mediaType?.startsWith('image/')) {
    return <img src={part.url} alt={part.filename ?? 'image'} className="mt-2 max-h-48 max-w-full rounded-lg object-contain" />;
  }
  if (part.mediaType === 'application/pdf') {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs">
        <span>📄</span>
        <span className="truncate">{part.filename ?? 'document.pdf'}</span>
      </div>
    );
  }
  return null;
}

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

  useEffect(() => {
    const guestId = getOrCreateGuestId(token);
    fetch(`/api/agent/${token}/thread`, { headers: { 'x-guest-id': guestId } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.messages?.length > 0) setMessages(data.messages); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isLoading = status === 'streaming' || status === 'submitted';

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
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted/40 border border-black/5 dark:border-white/8 rounded-tl-sm'
                      }`}
                    >
                      {msg.role === 'user'
                        ? msg.parts.map((part, i) => {
                            if (part.type === 'text') return <span key={i} className="whitespace-pre-wrap">{part.text}</span>;
                            if (part.type === 'file') return <FilePart key={i} part={part as FileUIPart} />;
                            return null;
                          })
                        : msg.parts.map((part, i) =>
                            part.type === 'text' ? <MarkdownText key={i} content={part.text} isAssistant /> : null
                          )}
                    </div>
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
                <PromptInputTextarea
                  placeholder="อยากให้ Vaja ช่วยอะไร?"
                  className="flex-1 self-stretch resize-none rounded-none border-0 bg-transparent shadow-none max-h-[40vh] overflow-y-auto px-4 pb-2 pt-1 text-sm leading-6 font-light outline-none text-left"
                  disabled={isLoading}
                />
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
                  onStop={stop}
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
