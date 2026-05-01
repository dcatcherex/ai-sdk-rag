'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AgentStarterTask, AgentStarterTaskIcon } from '@/features/chat/components/empty-state/types';

const ICON_OPTIONS: Array<{ value: AgentStarterTaskIcon; label: string }> = [
  { value: 'message', label: 'Message' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'edit', label: 'Edit' },
  { value: 'mail', label: 'Mail' },
  { value: 'search', label: 'Search' },
  { value: 'chart', label: 'Chart' },
  { value: 'refresh', label: 'Refresh' },
  { value: 'sparkles', label: 'Sparkles' },
];

type AgentStarterTasksSectionProps = {
  starterTasks: AgentStarterTask[];
  onAddTask: () => void;
  onRemoveTask: (id: string) => void;
  onTaskChange: <K extends keyof AgentStarterTask>(id: string, field: K, value: AgentStarterTask[K]) => void;
};

export function AgentStarterTasksSection({
  starterTasks,
  onAddTask,
  onRemoveTask,
  onTaskChange,
}: AgentStarterTasksSectionProps) {
  const primaryCount = starterTasks.filter((task) => task.priority === 'primary').length;
  const secondaryCount = starterTasks.filter((task) => task.priority === 'secondary').length;

  return (
    <div className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Structured starter tasks</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Used by the chat empty state before local presets. Up to 4 primary and 6 secondary tasks.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={starterTasks.length >= 10}
          onClick={onAddTask}
        >
          <PlusIcon className="size-4" />
          Add task
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Primary: {primaryCount}/4</span>
        <span>Secondary: {secondaryCount}/6</span>
        <span>Total: {starterTasks.length}/10</span>
      </div>

      {starterTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          No structured tasks yet. Add tasks here for admin-managed agents that need a curated empty-state experience.
        </div>
      ) : (
        <div className="space-y-4">
          {starterTasks.map((task, index) => (
            <div key={task.id} className="space-y-3 rounded-xl border px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Task {index + 1}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveTask(task.id)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`starter-task-title-${task.id}`}>Title</Label>
                  <Input
                    id={`starter-task-title-${task.id}`}
                    value={task.title}
                    maxLength={120}
                    onChange={(event) => onTaskChange(task.id, 'title', event.target.value)}
                    placeholder="เช่น ร่าง Broadcast เปิดตัวสินค้า"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={task.priority}
                    onValueChange={(value: AgentStarterTask['priority']) => onTaskChange(task.id, 'priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor={`starter-task-description-${task.id}`}>Description</Label>
                  <Input
                    id={`starter-task-description-${task.id}`}
                    value={task.description}
                    maxLength={240}
                    onChange={(event) => onTaskChange(task.id, 'description', event.target.value)}
                    placeholder="อธิบายสั้น ๆ ว่างานนี้ช่วยอะไร"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <Select
                    value={task.icon}
                    onValueChange={(value: AgentStarterTaskIcon) => onTaskChange(task.id, 'icon', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`starter-task-prompt-${task.id}`}>Prepared prompt</Label>
                <Textarea
                  id={`starter-task-prompt-${task.id}`}
                  value={task.prompt}
                  maxLength={2000}
                  onChange={(event) => onTaskChange(task.id, 'prompt', event.target.value)}
                  placeholder="ข้อความที่จะเติมลง composer เมื่อผู้ใช้กด task นี้"
                  className="min-h-24"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
