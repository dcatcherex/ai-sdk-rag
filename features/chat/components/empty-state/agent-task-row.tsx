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
import { cn } from '@/lib/utils';
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

const accentClass: Record<AgentStarterTaskIcon, string> = {
  calendar: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  chart: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  edit: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  mail: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  message: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
  refresh: 'bg-orange-500/12 text-orange-700 dark:text-orange-300',
  search: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
  sparkles: 'bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300',
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
      className="group flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-2xl border border-black/6 bg-white/58 px-3 py-2.5 text-left shadow-[0_12px_34px_-32px_rgba(15,23,42,0.55)] transition-colors hover:border-black/10 hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
    >
      <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl', accentClass[task.icon])}>
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
