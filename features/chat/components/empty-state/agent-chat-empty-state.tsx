import { BotIcon } from 'lucide-react';
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-0 py-6 text-left md:gap-8 md:px-2 md:py-14">
      <section className="flex flex-col items-center gap-3 px-2 text-center md:px-3">
        <div className="flex size-16 items-center justify-center rounded-[24px] bg-white/70 shadow-sm ring-1 ring-black/6 dark:bg-white/8 dark:ring-white/10 md:size-18 md:rounded-[28px]">
          <div className="flex size-12 items-center justify-center rounded-[18px] bg-primary/10 text-primary md:size-14 md:rounded-[22px]">
            <BotIcon className="size-6 md:size-7" aria-hidden="true" />
          </div>
        </div>
        <p className="text-xl font-semibold tracking-tight text-foreground md:text-xl">{title}</p>
      </section>

      <section className="px-2 md:px-3">
        
        <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {primaryTasks.map((task) => (
            <AgentTaskCard key={task.id} task={task} onSelect={onSelectTask} />
          ))}
        </div>
      </section>

      {secondaryTasks.length > 0 ? (
        <section className="px-2 md:px-3">
          <div className="mb-4 md:mb-5">
            <h2 className="text-base font-semibold text-foreground md:text-lg">งานอื่นที่ช่วยได้</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {secondaryTasks.map((task) => (
              <AgentTaskRow key={task.id} task={task} onSelect={onSelectTask} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
