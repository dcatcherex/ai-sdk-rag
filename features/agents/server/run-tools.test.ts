import assert from 'node:assert/strict';
import test from 'node:test';

import { buildToolsForRun, resolveRunToolIds } from './run-tools';

test('resolveRunToolIds preserves null as all tools even when skills unlock more tools', () => {
  const resolved = resolveRunToolIds({
    baseToolIds: null,
    fallbackToolIds: ['search'],
    skillToolIds: ['weather'],
  });

  assert.equal(resolved, null);
});

test('resolveRunToolIds appends skill-unlocked tools without duplicates', () => {
  const resolved = resolveRunToolIds({
    baseToolIds: ['search', 'weather'],
    fallbackToolIds: ['ignored'],
    skillToolIds: ['weather', 'calendar'],
  });

  assert.deepEqual(resolved, ['search', 'weather', 'calendar']);
});

test('resolveRunToolIds falls back to agent tool ids when channel override is missing', () => {
  const resolved = resolveRunToolIds({
    fallbackToolIds: ['search'],
    skillToolIds: [],
  });

  assert.deepEqual(resolved, ['search']);
});

// ── buildToolsForRun ──────────────────────────────────────────────────────────

test('buildToolsForRun returns empty ToolSet when enabledToolIds is empty array', () => {
  const tools = buildToolsForRun({ userId: 'user_1', enabledToolIds: [] });
  assert.deepEqual(tools, {});
});

test('buildToolsForRun silently ignores unknown tool IDs', () => {
  const tools = buildToolsForRun({
    userId: 'user_1',
    enabledToolIds: ['nonexistent_tool_xyz', 'another_fake_tool'],
  });
  assert.deepEqual(tools, {});
});

test('buildToolsForRun includes weather tools when weather ID is enabled', () => {
  const tools = buildToolsForRun({ userId: 'user_1', enabledToolIds: ['weather'] });
  assert.ok('getWeather' in tools, 'getWeather tool should be present');
});

test('buildToolsForRun with null enabledToolIds includes weather tool', () => {
  const tools = buildToolsForRun({ userId: 'user_1', enabledToolIds: null });
  assert.ok('getWeather' in tools, 'null enabledToolIds should include all tools including weather');
});

test('buildToolsForRun produces the same weather tool set regardless of agentId', () => {
  const withAgent = buildToolsForRun({
    userId: 'user_1',
    enabledToolIds: ['weather'],
    agentId: 'agent_abc',
  });
  const withoutAgent = buildToolsForRun({
    userId: 'user_1',
    enabledToolIds: ['weather'],
    agentId: null,
  });
  assert.deepEqual(Object.keys(withAgent).sort(), Object.keys(withoutAgent).sort());
});
