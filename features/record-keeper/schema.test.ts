import assert from 'node:assert/strict';
import test from 'node:test';

import { activityRecordRowSchema, logActivityInputSchema } from './schema';

test('logActivityInputSchema accepts optional domain metadata', () => {
  const parsed = logActivityInputSchema.parse({
    contextType: 'agriculture',
    date: '2026-05-01',
    activity: 'Applied urea',
    metadata: {
      profileId: 'farm_123',
      entityIds: ['plot_back_field', 'cycle_tomato_2026'],
      entityType: 'crop_cycle',
      source: 'chat',
      plotName: 'Back field',
    },
  });

  assert.equal(parsed.metadata?.profileId, 'farm_123');
  assert.deepEqual(parsed.metadata?.entityIds, ['plot_back_field', 'cycle_tomato_2026']);
  assert.equal(parsed.metadata?.plotName, 'Back field');
});

test('activityRecordRowSchema accepts nullable metadata', () => {
  const parsed = activityRecordRowSchema.parse({
    id: 'record_1',
    contextType: 'agriculture',
    category: 'fertilizer',
    entity: 'tomato',
    date: '2026-05-01',
    activity: 'Applied urea',
    quantity: '50 kg',
    cost: '850',
    income: null,
    notes: null,
    metadata: {
      profileId: 'farm_123',
      entityIds: ['plot_back_field'],
    },
    createdAt: new Date().toISOString(),
  });

  assert.equal(parsed.metadata?.profileId, 'farm_123');
});
