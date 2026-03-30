'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowLeftIcon, BotIcon, SendIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AgentMeta = { name: string; description: string | null; starterPrompts: string[] };
type ShareMeta = { welcomeMessage: string | null };

const SESSION_KEY = (token: string) => `guest-session-${token}`;
const SESSION_ID_KEY = (token: string) => `guest-sid-${token}`;

export default function GuestChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [agentMeta, setAgentMeta] = useState<AgentMeta | null>(null);
  const [shareMeta, setShareMeta] = useState<ShareMeta | null>(null);
  const [input, setInput] = useState('');
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
        const sessionToken = sessionStorage.getItem(SESSION_KEY(token)) ?? '';
        // Generate a persistent session ID for analytics (once per browser session)
        let sessionId = sessionStorage.getItem(SESSION_ID_KEY(token));
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem(SESSION_ID_KEY(token), sessionId);
        }
        const h: Record<string, string> = { 'x-session-id': sessionId };
        if (sessionToken) h['x-guest-token'] = sessionToken;
        return h;
      },
    }),
    [token],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage({ parts: [{ type: 'text', text }] });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
            {/* Conversation starters */}
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
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-white/90 dark:bg-card/90 border border-black/5 dark:border-border rounded-bl-sm'
              }`}
            >
              {msg.parts.map((part, i) =>
                part.type === 'text' ? <span key={i}>{part.text}</span> : null
              )}
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
      <div className="sticky bottom-0 border-t border-black/5 dark:border-border bg-white/80 dark:bg-card/80 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message…"
              className="min-h-[44px] max-h-32 resize-none rounded-xl text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              type="button"
              size="icon"
              className="size-11 rounded-xl shrink-0"
              disabled={!input.trim() || isLoading}
              onClick={handleSend}
            >
              <SendIcon className="size-4" />
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Powered by AI · Free, no account needed
          </p>
        </div>
      </div>
    </div>
  );
}
