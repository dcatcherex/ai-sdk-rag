import { BotIcon, SparklesIcon } from 'lucide-react';
import { AgentTaskCard } from './agent-task-card';
import { AgentTaskRow } from './agent-task-row';
import { getAgentStarterTasks } from './task-starter-data';
import type { AgentStarterTask } from './types';

type AgentChatEmptyStateProps = {
  agentName?: string;
  agentDescription?: string | null;
  starterTasks?: AgentStarterTask[];
  generalStarterPrompts?: string[];
  onSelectTask: (task: AgentStarterTask) => void;
};

export function AgentChatEmptyState({
  agentName,
  agentDescription,
  starterTasks,
  generalStarterPrompts = [],
  onSelectTask,
}: AgentChatEmptyStateProps) {
  const tasks = getAgentStarterTasks({
    agentName,
    agentDescription,
    starterTasks,
    generalStarterPrompts,
  });
  const primaryTasks = tasks.filter((task) => task.priority === 'primary').slice(0, 4);
  const secondaryTasks = tasks.filter((task) => task.priority === 'secondary').slice(0, 6);
  const title = agentName ?? 'Vaja AI พร้อมช่วยงานแล้ว';
  const subtitle = agentDescription ?? 'เลือกงานเริ่มต้น หรือพิมพ์สิ่งที่อยากให้ช่วยด้านล่าง';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-0 py-4 text-left md:gap-6 md:px-2 md:py-10">
      <section className="mx-1 rounded-[24px] border border-black/6 bg-white/64 p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-white/[0.04] md:mx-3 md:p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex size-13 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-zinc-950 md:size-14">
            <BotIcon className="size-6" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-amber-300 text-slate-950 ring-2 ring-white dark:ring-zinc-950">
              <SparklesIcon className="size-3" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-6 text-slate-950 dark:text-zinc-50 md:text-lg">
              {title}
            </p>
            <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400 md:text-sm">
              {subtitle}
            </p>
          </div>
        </div>
      </section>

      <section className="px-1 md:px-3">
        <div className="mb-2 flex items-center justify-between px-1 md:mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
            เริ่มเร็ว
          </h2>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
          {primaryTasks.map((task) => (
            <AgentTaskCard key={task.id} task={task} onSelect={onSelectTask} />
          ))}
        </div>
      </section>

      {secondaryTasks.length > 0 ? (
        <section className="px-1 md:px-3">
          <div className="mb-2 flex items-center justify-between px-1 md:mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
              งานอื่นที่ช่วยได้
            </h2>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {secondaryTasks.map((task) => (
              <AgentTaskRow key={task.id} task={task} onSelect={onSelectTask} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
