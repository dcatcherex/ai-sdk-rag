'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessage, ChatMessagePart } from '../types';
import { getTextContentFromParts } from '../utils/message-parts';

type OutlineItem = {
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
  level: number;
  questionIndex?: number;
};

function extractHeadings(text: string): Array<{ text: string; level: number }> {
  const headings: Array<{ text: string; level: number }> = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      headings.push({ text: match[2].trim(), level: match[1].length });
    }
  }
  return headings;
}

type ConversationOutlineProps = {
  messages: ChatMessage[];
};

export const ConversationOutline = ({ messages }: ConversationOutlineProps) => {
  const [filter, setFilter] = useState('');

  const items = useMemo((): OutlineItem[] => {
    const result: OutlineItem[] = [];
    let questionIndex = 0;

    for (const message of messages) {
      const parts = message.parts as ChatMessagePart[] | undefined;
      if (!parts) continue;

      const text = getTextContentFromParts(parts);
      if (!text.trim()) continue;

      if (message.role === 'user') {
        questionIndex += 1;
        result.push({
          messageId: message.id,
          role: 'user',
          text: text.trim().slice(0, 200),
          level: 0,
          questionIndex,
        });
      } else {
        const headings = extractHeadings(text);
        if (headings.length > 0) {
          for (const h of headings) {
            result.push({
              messageId: message.id,
              role: 'assistant',
              text: h.text,
              level: h.level,
            });
          }
        } else {
          const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
          if (firstLine) {
            result.push({
              messageId: message.id,
              role: 'assistant',
              text: firstLine.trim().slice(0, 100),
              level: 1,
            });
          }
        }
      }
    }

    return result;
  }, [messages]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const lower = filter.toLowerCase();
    return items.filter((item) => item.text.toLowerCase().includes(lower));
  }, [items, filter]);

  const scrollTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const turnCount = items.filter((i) => i.role === 'user').length;

  return (
    <div className="flex h-[calc(100vh-3rem)] w-70 flex-col rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] dark:shadow-[0_35px_80px_-60px_rgba(0,0,0,0.7)] backdrop-blur overflow-hidden md:rounded-3xl">
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-3.5">
        <span className="text-sm font-semibold">Outline</span>
        {turnCount > 0 && (
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
          </span>
        )}
      </div>

      <div className="border-b border-black/5 dark:border-white/10 px-3 py-2.5">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 pl-7 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto py-1.5">
        {messages.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Start a conversation to see the outline
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">No matches</p>
        ) : (
          filtered.map((item, i) => (
            <button
              key={`${item.messageId}-${i}`}
              type="button"
              onClick={() => scrollTo(item.messageId)}
              className={`w-full text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60 ${
                item.role === 'user' ? 'mt-1 px-3 py-2' : 'px-3 py-1'
              }`}
              style={
                item.role === 'assistant'
                  ? { paddingLeft: `${(item.level - 1) * 10 + 20}px` }
                  : undefined
              }
            >
              {item.role === 'user' ? (
                <span className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary">
                    {item.questionIndex}
                  </span>
                  <span className="text-xs font-semibold leading-snug line-clamp-2 text-foreground">
                    {item.text}
                  </span>
                </span>
              ) : (
                <span
                  className={`block text-xs leading-snug line-clamp-1 text-muted-foreground ${
                    item.level === 1 ? 'font-medium' : ''
                  }`}
                >
                  {item.text}
                </span>
              )}
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
};
