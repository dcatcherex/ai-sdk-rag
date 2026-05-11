import { BUILTIN_TASK_FLOW_TEMPLATES } from '@/features/task-flows/templates/agriculture';
import type { TaskFlowChannel, TaskFlowDefinition } from '@/features/task-flows/types';

type GetTaskFlowDefinitionsInput = {
  channel?: TaskFlowChannel;
  activeSkillIds?: string[];
  activeSkillNames?: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getTaskFlowDefinitions(input: GetTaskFlowDefinitionsInput = {}): TaskFlowDefinition[] {
  const activeSkillKeys = new Set([
    ...(input.activeSkillIds ?? []).map(normalize),
    ...(input.activeSkillNames ?? []).map(normalize),
  ]);

  return BUILTIN_TASK_FLOW_TEMPLATES.filter((flow) => {
    if (input.channel && flow.channels?.length && !flow.channels.includes(input.channel)) {
      return false;
    }

    if (!flow.skillKey) {
      return true;
    }

    return activeSkillKeys.has(normalize(flow.skillKey));
  });
}

export function getTaskFlowDefinitionByKey(flowKey: string): TaskFlowDefinition | null {
  return BUILTIN_TASK_FLOW_TEMPLATES.find((flow) => flow.key === flowKey) ?? null;
}
