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
      className="group flex min-h-28 w-full flex-col rounded-2xl bg-white/70 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-white/5 dark:hover:bg-white/8 md:min-h-36 md:p-5"
    >
      <span className={cn('mb-3 inline-flex size-10 items-center justify-center rounded-xl md:mb-5 md:size-12 md:rounded-2xl', accentClass[task.icon])}>
        <Icon className="size-4 md:size-5" aria-hidden="true" />
      </span>
      <span className="text-sm leading-6 text-foreground">{task.title}</span>
    </button>
  );
}
