import assert from 'node:assert/strict';
import test from 'node:test';

import { getAgentStarterTasks } from './task-starter-data';

test('official marketing agent resolves to structured preset tasks', () => {
  const tasks = getAgentStarterTasks({
    agentName: 'Marketing & Content',
    agentDescription:
      'Creates posts, campaigns, captions, and marketing copy for LINE, Facebook, Instagram, and more.',
  });

  assert.ok(tasks.length >= 4);
  assert.equal(tasks[0]?.priority, 'primary');
});

test('generic fallback remains available when no agent metadata exists', () => {
  const tasks = getAgentStarterTasks({
    agentName: null,
    agentDescription: null,
    generalStarterPrompts: [],
  });

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.priority === 'primary'));
});

test('explicit structured starter tasks override local presets', () => {
  const tasks = getAgentStarterTasks({
    agentName: 'Marketing & Content',
    agentDescription: 'Creates posts, campaigns, captions, and marketing copy.',
    starterTasks: [
      {
        id: 'custom-primary',
        title: 'Draft a branch-specific promotion',
        description: 'Create a targeted promotion for one branch or one local audience.',
        prompt: 'Help me draft a promotion for branch [branch name] aimed at [customer segment].',
        icon: 'message',
        priority: 'primary',
      },
    ],
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.title, 'Draft a branch-specific promotion');
});
