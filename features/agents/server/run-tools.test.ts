import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRunToolIds } from './run-tools';

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
