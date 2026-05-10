import {
  CalendarIcon,
  FilePenLineIcon,
  MailIcon,
  MessageSquareIcon,
  RefreshCcwIcon,
  SearchIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';
import type { AgentStarterTask, AgentStarterTaskIcon } from './types';

const iconMap: Record<AgentStarterTaskIcon, LucideIcon> = {
  calendar: CalendarIcon,
  chart: FilePenLineIcon,
  edit: FilePenLineIcon,
  mail: MailIcon,
  message: MessageSquareIcon,
  refresh: RefreshCcwIcon,
  search: SearchIcon,
  sparkles: SparklesIcon,
};


type AgentTaskRowProps = {
  task: AgentStarterTask;
  onSelect: (task: AgentStarterTask) => void;
};

export function AgentTaskRow({ task, onSelect }: AgentTaskRowProps) {
  const Icon = iconMap[task.icon];

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="group flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-2xl border border-black/6 bg-white/58 px-3 py-2.5 text-left shadow-[0_12px_34px_-32px_rgba(15,23,42,0.55)] transition-all hover:border-primary/40 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary/50 dark:hover:bg-white/[0.07]"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{task.title}</span>
        {task.description ? (
          <span className="block truncate text-xs text-slate-500 dark:text-zinc-400">
            {task.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
