'use client';

import type { ToolManifest } from '@/features/tools/registry/types';

type Props = {
  manifest: ToolManifest;
};

export function QuizToolPage({ manifest }: Props) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{manifest.description}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Quiz tool UI coming soon. Use the chat to generate quizzes, flashcards, and study plans via
        the AI agent.
      </p>
    </div>
  );
}
