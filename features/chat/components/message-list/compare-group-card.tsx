'use client';

import { Streamdown } from 'streamdown';
import { ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { Button } from '@/components/ui/button';
import type { ChatMessage, ChatMessageMetadata, MessageReaction } from '@/features/chat/types';
import type { ReactionMap } from './types';

const CompareMarkdown = ({ content }: { content: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:whitespace-pre-wrap [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:pl-5 [&_ul>li]:my-0.5 [&_ul>li]:indent-[-1em] [&_ul>li]:before:content-['•'] [&_ul>li]:before:mr-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:my-0.5 [&_ol>li]:pl-1.5 [&_ol>li]:indent-[-0.25em]">
    <Streamdown
      components={{
        code: ({ inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const codeContent = String(children).replace(/\n$/, '');
          if (!inline && match) {
            return <CodeBlock code={codeContent} language={match[1] as any} />;
          }
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }: any) => <>{children}</>,
      }}
    >
      {content}
    </Streamdown>
  </div>
);

type CompareGroupCardProps = {
  messages: ChatMessage[];
  messageReactions: ReactionMap;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
};

export const CompareGroupCard = ({ messages, messageReactions, onToggleReaction }: CompareGroupCardProps) => {
  const gridClass =
    messages.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : messages.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2';

  return (
    <div className={`my-3 grid gap-3 ${gridClass}`}>
      {messages.map((m) => {
        const meta = m.metadata as ChatMessageMetadata;
        const modelInfo = { provider: (meta.compareModelId ?? '').split('/')[0] ?? 'google' };
        const textContent = (m.parts as any[])
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('');
        const imagePart = (m.parts as any[]).find((p) => p.type === 'file');
        const reaction = messageReactions[m.id];

        return (
          <div
            key={m.id}
            className="flex flex-col overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-800/50 px-3 py-1.5">
              <ModelSelectorLogo provider={modelInfo.provider as any} />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1">
                {meta.compareModelName ?? meta.compareModelId}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 max-h-[400px]">
              {imagePart ? (
                <img src={imagePart.url} alt="Generated" className="max-w-full rounded-lg" />
              ) : textContent ? (
                <CompareMarkdown content={textContent} />
              ) : null}
            </div>
            <div className="flex gap-1 border-t border-black/5 dark:border-white/10 px-3 py-1.5">
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${reaction === 'thumbs_up' ? 'text-green-600' : ''}`}
                onClick={() => onToggleReaction(m.id, 'thumbs_up')}
              >
                <ThumbsUpIcon className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${reaction === 'thumbs_down' ? 'text-red-500' : ''}`}
                onClick={() => onToggleReaction(m.id, 'thumbs_down')}
              >
                <ThumbsDownIcon className="size-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
