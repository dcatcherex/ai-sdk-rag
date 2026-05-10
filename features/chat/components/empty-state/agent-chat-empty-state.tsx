import Image from 'next/image';
import { BotIcon, SparklesIcon } from 'lucide-react';
import { AgentTaskCard } from './agent-task-card';
import { getAgentStarterTasks } from './task-starter-data';
import type { AgentStarterTask } from './types';

type AgentChatEmptyStateProps = {
  agentName?: string;
  agentDescription?: string | null;
  agentImageUrl?: string | null;
  starterTasks?: AgentStarterTask[];
  generalStarterPrompts?: string[];
  onSelectTask: (task: AgentStarterTask) => void;
};

export function AgentChatEmptyState({
  agentName,
  agentDescription,
  agentImageUrl,
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
  const title = agentName ?? 'Vaja AI พร้อมช่วยงานแล้ว';
  const subtitle = agentDescription ?? 'เลือกงานเริ่มต้น หรือพิมพ์สิ่งที่อยากให้ช่วยด้านล่าง';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-0 py-4 text-left md:gap-6 md:px-2 md:py-10">
      <section className="mx-1 md:mx-3">
        {agentImageUrl ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="relative size-24 overflow-hidden rounded-3xl md:size-28">
              <Image
                src={agentImageUrl}
                alt={title}
                fill
                className="object-cover"
                sizes="112px"
              />
            </div>
            <div>
              <p className="text-lg font-semibold leading-7 text-slate-950 dark:text-zinc-50 md:text-xl">
                {title}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-zinc-400">
                {subtitle}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-black/6 bg-white/64 p-4  dark:border-white/10 dark:bg-white/4 md:p-5">
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
          </div>
        )}
      </section>

      <section className="px-1 md:px-3">
        <div className="grid gap-2.5 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
          {primaryTasks.map((task) => (
            <AgentTaskCard key={task.id} task={task} onSelect={onSelectTask} />
          ))}
        </div>
      </section>
    </div>
  );
}
