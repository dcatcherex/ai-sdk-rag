'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { FileUIPart } from 'ai';
import { ArrowLeftIcon, BotIcon, CheckIcon, CopyIcon, ImageIcon, SendIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MarkdownText } from '@/components/message-renderer/markdown-text';
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import type { AgentStarterTask } from '@/features/chat/components/empty-state/types';

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

const AttachButton = () => {
  const attachments = usePromptInputAttachments();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
      onClick={() => attachments.openFileDialog()}
    >
      <ImageIcon className="size-4" />
    </Button>
  );
};

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

function FilePart({ part }: { part: FileUIPart }) {
  const isImage = part.mediaType?.startsWith('image/');
  const isPdf = part.mediaType === 'application/pdf';
  if (isImage) {
    return (
      <img
        src={part.url}
        alt={part.filename ?? 'image'}
        className="mt-2 max-h-48 max-w-full rounded-lg object-contain"
      />
    );
  }
  if (isPdf) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs">
        <span className="font-medium">📄</span>
        <span className="truncate">{part.filename ?? 'document.pdf'}</span>
      </div>
    );
  }
  return null;
}

function AgentAvatar({ imageUrl, name, size = 'sm' }: { imageUrl: string | null; name: string; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'size-12' : 'size-7';
  const iconDim = size === 'md' ? 'size-6' : 'size-4';
  if (imageUrl) {
    return (
      <div className={`${dim} rounded-xl overflow-hidden shrink-0`}>
        <Image src={imageUrl} alt={name} width={size === 'md' ? 48 : 28} height={size === 'md' ? 48 : 28} className="object-cover w-full h-full" />
      </div>
    );
  }
  return (
    <div className={`${dim} rounded-xl bg-primary/10 flex items-center justify-center shrink-0`}>
      <BotIcon className={`${iconDim} text-primary`} />
    </div>
  );
}

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

export default function GuestChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [agentMeta, setAgentMeta] = useState<AgentMeta | null>(null);
  const [shareMeta, setShareMeta] = useState<ShareMeta | null>(null);
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

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  useEffect(() => {
    const guestId = getOrCreateGuestId(token);
    fetch(`/api/agent/${token}/thread`, { headers: { 'x-guest-id': guestId } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.messages?.length > 0) setMessages(data.messages);
      })
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
    for (const f of files) {
      parts.push({ type: 'file', url: f.url, mediaType: f.mediaType, filename: f.filename });
    }
    sendMessage({ parts } as Parameters<typeof sendMessage>[0]);
  }, [isLoading, sendMessage]);

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
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7f4ed_0%,#eef6f5_46%,#eeeaf8_100%)] dark:bg-[linear-gradient(135deg,#15161d_0%,#101a1a_48%,#171323_100%)] text-foreground flex flex-col items-center px-0 py-0 md:px-4 md:py-5">
      <div className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden border border-black/5 bg-[rgba(255,253,249,0.88)] shadow-[0_28px_70px_-48px_rgba(31,41,55,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/72 dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.75)] md:h-[calc(100vh-2.5rem)] md:rounded-[28px]">

        {/* Header */}
        <header className="flex items-center gap-3 border-b border-black/5 dark:border-white/8 px-4 py-3 shrink-0">
          <Link href={`/agent/${token}`}>
            <Button variant="ghost" size="icon" className="size-8 rounded-lg shrink-0">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <AgentAvatar imageUrl={agentMeta?.imageUrl ?? null} name={agentMeta?.name ?? ''} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{agentMeta?.name ?? '…'}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Online · Ready to help</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AgentAvatar imageUrl={agentMeta?.imageUrl ?? null} name={agentMeta?.name ?? ''} size="md" />
              <div>
                <p className="font-semibold">{agentMeta?.name ?? 'AI Agent'}</p>
                {agentMeta?.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">{agentMeta.description}</p>
                )}
              </div>

              {shareMeta?.welcomeMessage ? (
                <div className="mt-2 flex justify-start w-full max-w-md text-left">
                  <AgentAvatar imageUrl={agentMeta?.imageUrl ?? null} name={agentMeta?.name ?? ''} />
                  <div className="ml-2.5 rounded-2xl rounded-tl-sm bg-muted/50 border border-black/5 dark:border-white/8 px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {shareMeta.welcomeMessage}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Type a message to start…</p>
              )}

              {agentMeta?.starterTasks && agentMeta.starterTasks.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2 max-w-sm">
                  {agentMeta.starterTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        if (isLoading) return;
                        sendMessage({ parts: [{ type: 'text', text: task.prompt }] });
                      }}
                      className="rounded-xl border border-black/8 dark:border-white/10 bg-white/80 dark:bg-zinc-800/60 px-3 py-2 text-xs text-left hover:bg-muted/60 transition shadow-sm"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <AgentAvatar imageUrl={agentMeta?.imageUrl ?? null} name={agentMeta?.name ?? ''} />
              )}
              <div className={`group relative max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
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
                      )
                  }
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
              <AgentAvatar imageUrl={agentMeta?.imageUrl ?? null} name={agentMeta?.name ?? ''} />
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

        {/* Composer */}
        <div
          className="relative shrink-0 border-t border-black/5 dark:border-white/8 px-4 py-3"
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
          <PromptInput
            globalDrop
            accept="image/*,application/pdf"
            multiple
            className="rounded-xl border border-black/8 dark:border-white/10 shadow-sm"
            onSubmit={handleSubmit}
          >
            <PromptInputHeader>
              <ComposerAttachments />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                placeholder="Type your message…"
                className="min-h-[44px] max-h-36 text-sm px-3 py-2.5"
                disabled={isLoading}
              />
            </PromptInputBody>
            <PromptInputFooter className="px-2 py-1.5 flex items-center justify-between">
              <AttachButton />
              <Button
                type="submit"
                size="icon"
                className="size-8 rounded-lg shrink-0"
                disabled={isLoading}
              >
                <SendIcon className="size-3.5" />
              </Button>
            </PromptInputFooter>
          </PromptInput>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Powered by AI · Free, no account needed
          </p>
        </div>
      </div>
    </div>
  );
}
