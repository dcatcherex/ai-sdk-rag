import type { AgentStarterTask } from '@/features/chat/components/empty-state/types';

const DEFAULT_STARTER_TASK_DESCRIPTION = 'Start here, then customize the details for your exact use case.';

function toTaskId(prompt: string, index: number): string {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return base ? `starter-${base}-${index + 1}` : `starter-task-${index + 1}`;
}

function toTaskTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= 52) {
    return trimmed;
  }

  return `${trimmed.slice(0, 49).trimEnd()}...`;
}

export function buildStarterTasksFromPrompts(prompts: string[]): AgentStarterTask[] {
  return prompts
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((prompt, index) => ({
      id: toTaskId(prompt, index),
      title: toTaskTitle(prompt),
      description: DEFAULT_STARTER_TASK_DESCRIPTION,
      prompt,
      icon: 'sparkles' as const,
      priority: 'primary' as const,
    }));
}

export function getStarterTaskPrompts(
  starterTasks?: AgentStarterTask[] | null,
  limit = 4,
): string[] {
  return (starterTasks ?? [])
    .map((task) => task.prompt.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function getStarterTaskActions(
  starterTasks?: AgentStarterTask[] | null,
  limit = 4,
): Array<{ title: string; prompt: string }> {
  return (starterTasks ?? [])
    .map((task) => ({ title: task.title.trim(), prompt: task.prompt.trim() }))
    .filter((task) => task.title && task.prompt)
    .slice(0, limit);
}
