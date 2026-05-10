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
  calendar: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/15 dark:text-emerald-300',
  chart: 'bg-amber-500/12 text-amber-700 ring-amber-500/15 dark:text-amber-300',
  edit: 'bg-sky-500/12 text-sky-700 ring-sky-500/15 dark:text-sky-300',
  mail: 'bg-rose-500/12 text-rose-700 ring-rose-500/15 dark:text-rose-300',
  message: 'bg-cyan-500/12 text-cyan-700 ring-cyan-500/15 dark:text-cyan-300',
  refresh: 'bg-orange-500/12 text-orange-700 ring-orange-500/15 dark:text-orange-300',
  search: 'bg-indigo-500/12 text-indigo-700 ring-indigo-500/15 dark:text-indigo-300',
  sparkles: 'bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/15 dark:text-fuchsia-300',
};

type AgentTaskCardProps = {
  task: AgentStarterTask;
  onSelect: (task: AgentStarterTask) => void;
};

export function AgentTaskCard({ task, onSelect }: AgentTaskCardProps) {
  const Icon = iconMap[task.icon];

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-[18px] border border-black/6 bg-white/72 p-3 text-left shadow-[0_14px_42px_-36px_rgba(15,23,42,0.65)] transition-all hover:border-black/10 hover:bg-white/92 hover:shadow-[0_18px_48px_-34px_rgba(15,23,42,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.075] md:min-h-32 md:flex-col md:items-start md:p-4 md:hover:-translate-y-0.5"
    >
      {/* Mobile: theme-consistent icon | Desktop: colored accent icon */}
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl ring-1 size-8 md:mb-4 md:size-10', 'bg-primary/10 text-primary ring-primary/15 md:hidden')}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className={cn('hidden shrink-0 items-center justify-center rounded-xl ring-1 md:inline-flex md:size-10', accentClass[task.icon])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-slate-800 dark:text-zinc-100">{task.title}</span>
        {task.description ? (
          <span className="mt-1 hidden line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400 md:block">
            {task.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
