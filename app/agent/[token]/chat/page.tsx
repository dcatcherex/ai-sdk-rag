'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { FileUIPart } from 'ai';
import { ArrowLeftIcon, BotIcon, ImageIcon, SendIcon } from 'lucide-react';
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

type AgentMeta = { name: string; description: string | null; starterPrompts: string[] };
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

// Plain button that opens the file dialog (avoids DropdownMenuItem context requirement)
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

// Inline attachment strip shown above the textarea
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

// File part thumbnail shown inside user message bubble
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

  // Rehydrate thread history on mount
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-black/5 dark:border-border bg-white/80 dark:bg-card/80 backdrop-blur">
        <Link href={`/agent/${token}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BotIcon className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{agentMeta?.name ?? '…'}</p>
            <p className="text-[11px] text-muted-foreground">Online · Ready to help</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BotIcon className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium">{agentMeta?.name ?? 'AI Agent'}</p>
            {agentMeta?.description && (
              <p className="text-xs text-muted-foreground max-w-xs">{agentMeta.description}</p>
            )}
            {shareMeta?.welcomeMessage ? (
              <div className="mt-4 flex justify-start w-full max-w-sm">
                <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <BotIcon className="size-4 text-primary" />
                </div>
                <div className="bg-white/90 dark:bg-card/90 border border-black/5 dark:border-border rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm whitespace-pre-wrap text-left">
                  {shareMeta.welcomeMessage}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Type a message to start…</p>
            )}
            {agentMeta?.starterPrompts && agentMeta.starterPrompts.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-sm">
                {agentMeta.starterPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (isLoading) return;
                      sendMessage({ parts: [{ type: 'text', text: prompt }] });
                    }}
                    className="rounded-xl border border-input bg-white/80 dark:bg-card/80 px-3 py-2 text-xs text-left hover:bg-muted/60 transition shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                <BotIcon className="size-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-white/90 dark:bg-card/90 border border-black/5 dark:border-border rounded-bl-sm'
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
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
              <BotIcon className="size-4 text-primary" />
            </div>
            <div className="bg-white/90 dark:bg-card/90 border border-black/5 dark:border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
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

      {/* Input */}
      <div
        className="relative sticky bottom-0 border-t border-black/5 dark:border-border bg-white/80 dark:bg-card/80 backdrop-blur px-4 py-3"
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
        <div className="max-w-2xl mx-auto">
          <PromptInput
            globalDrop
            accept="image/*,application/pdf"
            multiple
            className="rounded-xl"
            onSubmit={handleSubmit}
          >
            <PromptInputHeader>
              <ComposerAttachments />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                placeholder="Type your message…"
                className="min-h-[44px] max-h-32 text-sm px-3 py-2.5"
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
