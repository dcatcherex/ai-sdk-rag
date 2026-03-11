'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { Button } from '@/components/ui/button';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { availableModels } from '@/lib/ai';
import type { ChatMessage, ChatMessageMetadata } from '@/features/chat/types';

export type ComparePrompt = {
  text: string;
  groupId: string;
  timestamp: number;
};

type Reaction = 'thumbs_up' | 'thumbs_down' | null;

const CompareMarkdown = memo(({ content }: { content: string }) => (
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
));
CompareMarkdown.displayName = 'CompareMarkdown';

type CompareStreamItemProps = {
  modelId: string;
  groupId: string;
  promptText: string;
  threadId: string;
  userMessageId: string;
  onComplete: (message: ChatMessage) => void;
};

const CompareStreamItem = ({
  modelId,
  groupId,
  promptText,
  threadId,
  userMessageId,
  onComplete,
}: CompareStreamItemProps) => {
  const modelInfo = availableModels.find((m) => m.id === modelId);
  const [reaction, setReaction] = useState<Reaction>(null);
  const submitted = useRef(false);
  const completedRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/compare',
        body: { modelId, compareGroupId: groupId, threadId, userMessageId, userPrompt: promptText },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messages, sendMessage, status } = useChat({ transport });

  useEffect(() => {
    if (!submitted.current) {
      submitted.current = true;
      sendMessage({ text: promptText });
    }
  }, [sendMessage, promptText]);

  // Fire onComplete once when stream finishes
  useEffect(() => {
    if (status === 'ready' && !completedRef.current) {
      const assistantMsg = messages.find((m) => m.role === 'assistant');
      if (assistantMsg) {
        completedRef.current = true;
        const metadata: ChatMessageMetadata = {
          compareGroupId: groupId,
          compareModelId: modelId,
          compareModelName: modelInfo?.name ?? modelId,
        };
        onComplete({ ...assistantMsg, metadata } as ChatMessage);
      }
    }
  }, [status, messages, groupId, modelId, modelInfo, onComplete]);

  const assistantMsg = messages.find((m) => m.role === 'assistant');

  const textContent = (assistantMsg?.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');

  const imagePart = (assistantMsg?.parts ?? []).find(
    (p): p is { type: 'file'; mediaType: string; url: string } => p.type === 'file'
  );

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleVote = async (vote: 'thumbs_up' | 'thumbs_down') => {
    const newReaction: Reaction = reaction === vote ? null : vote;
    const previousReaction = reaction;
    setReaction(newReaction);
    try {
      await fetch('/api/compare/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, previousReaction, newReaction }),
      });
    } catch {
      setReaction(previousReaction);
    }
  };

  return (
    <div className="flex min-h-[200px] flex-col overflow-hidden rounded-xl border border-black/5 bg-white dark:border-border dark:bg-card">
      <div className="flex items-center gap-2 border-b border-black/5 bg-zinc-50/80 px-3 py-2 dark:border-border dark:bg-muted/50">
        <ModelSelectorLogo provider={modelInfo?.provider ?? 'google'} />
        <span className="flex-1 truncate text-xs font-medium text-zinc-700 dark:text-foreground/80">
          {modelInfo?.name ?? modelId}
        </span>
        {isStreaming && (
          <span className="animate-pulse text-[10px] text-muted-foreground">generating…</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {imagePart ? (
          <img src={imagePart.url} alt="Generated" className="max-w-full rounded-lg object-contain" />
        ) : textContent ? (
          <CompareMarkdown content={textContent} />
        ) : isStreaming ? (
          <Shimmer className="text-sm">Generating…</Shimmer>
        ) : null}
      </div>

      {assistantMsg && !isStreaming && (
        <div className="flex items-center gap-1 border-t border-black/5 px-3 py-2 dark:border-border">
          <Button
            size="icon"
            variant="ghost"
            className={`size-7 ${reaction === 'thumbs_up' ? 'text-green-600' : ''}`}
            onClick={() => handleVote('thumbs_up')}
            title="Helpful"
          >
            <ThumbsUpIcon className="size-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`size-7 ${reaction === 'thumbs_down' ? 'text-red-500' : ''}`}
            onClick={() => handleVote('thumbs_down')}
            title="Not helpful"
          >
            <ThumbsDownIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

type CompareGridProps = {
  modelIds: string[];
  submittedPrompt: ComparePrompt | null;
  threadId: string;
  userMessageId: string;
  onAllComplete: (userMessage: ChatMessage, assistantMessages: ChatMessage[]) => void;
};

export const CompareGrid = ({
  modelIds,
  submittedPrompt,
  threadId,
  userMessageId,
  onAllComplete,
}: CompareGridProps) => {
  const completedMessages = useRef<ChatMessage[]>([]);
  const allCompleteFired = useRef(false);

  // Reset on each new prompt
  useEffect(() => {
    completedMessages.current = [];
    allCompleteFired.current = false;
  }, [submittedPrompt?.groupId]);

  const handleItemComplete = useCallback(
    (msg: ChatMessage) => {
      completedMessages.current.push(msg);
      if (completedMessages.current.length === modelIds.length && !allCompleteFired.current) {
        allCompleteFired.current = true;
        const userMessage: ChatMessage = {
          id: userMessageId,
          role: 'user',
          parts: [{ type: 'text', text: submittedPrompt!.text }],
          metadata: { compareGroupId: submittedPrompt!.groupId },
        };
        onAllComplete(userMessage, [...completedMessages.current]);
      }
    },
    [modelIds.length, userMessageId, submittedPrompt, onAllComplete]
  );

  const gridClass =
    modelIds.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : modelIds.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2';

  if (!submittedPrompt) return null;

  return (
    <div className={`grid gap-3 p-4 ${gridClass}`}>
      {modelIds.map((modelId) => (
        <CompareStreamItem
          key={`${modelId}-${submittedPrompt.groupId}`}
          modelId={modelId}
          groupId={submittedPrompt.groupId}
          promptText={submittedPrompt.text}
          threadId={threadId}
          userMessageId={userMessageId}
          onComplete={handleItemComplete}
        />
      ))}
    </div>
  );
};
