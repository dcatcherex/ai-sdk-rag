'use client';

import { createContext, useCallback, useContext, useState } from 'react';

export type GenerationTaskStatus = 'polling' | 'success' | 'failed' | 'timeout' | 'delayed';

export type GenerationTask = {
  generationId: string;
  toolName: string;
  status: GenerationTaskStatus;
  startedAt?: string;
};

type ContextValue = {
  tasks: Record<string, GenerationTask>;
  upsertTask: (task: GenerationTask) => void;
};

const GenerationProgressContext = createContext<ContextValue | null>(null);

export function GenerationProgressProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Record<string, GenerationTask>>({});

  const upsertTask = useCallback((task: GenerationTask) => {
    setTasks(prev => ({ ...prev, [task.generationId]: task }));
  }, []);

  return (
    <GenerationProgressContext.Provider value={{ tasks, upsertTask }}>
      {children}
    </GenerationProgressContext.Provider>
  );
}

/** Returns null when used outside the provider (safe for optional usage). */
export function useGenerationProgress() {
  return useContext(GenerationProgressContext);
}
