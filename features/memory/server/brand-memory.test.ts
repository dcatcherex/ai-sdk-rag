import assert from 'node:assert/strict';
import test from 'node:test';

import type { BrandMemoryRecord } from '@/features/memory/types';
import { buildBrandMemoryPromptBlockFromRecords } from './brand-memory';

const baseRecord = (overrides: Partial<BrandMemoryRecord>): BrandMemoryRecord => ({
  id: 'mem_1',
  scopeType: 'brand',
  scopeId: 'brand_1',
  memoryType: 'shared_fact',
  status: 'approved',
  title: 'Base fact',
  content: 'Base content',
  summary: 'Base summary',
  category: null,
  sourceType: 'manual',
  sourceThreadId: null,
  createdByUserId: 'user_1',
  approvedByUserId: 'user_1',
  rejectedByUserId: null,
  confidence: 100,
  metadata: {},
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  approvedAt: new Date('2026-05-01T00:00:00Z'),
  rejectedAt: null,
  archivedAt: null,
  lastReferencedAt: null,
  ...overrides,
});

test('buildBrandMemoryPromptBlockFromRecords filters approved relevant records', () => {
  const result = buildBrandMemoryPromptBlockFromRecords([
    baseRecord({
      id: 'approved-match',
      title: 'Mango tone of voice',
      content: 'Use warm farmer-friendly language for mango campaigns.',
      summary: 'Warm farmer-friendly language for mango campaigns.',
      category: 'voice',
      updatedAt: new Date('2026-05-03T00:00:00Z'),
    }),
    baseRecord({
      id: 'approved-miss',
      title: 'Rice seasonal plan',
      content: 'Focus on irrigation milestones.',
      summary: 'Irrigation milestones for rice season.',
      category: 'planning',
      updatedAt: new Date('2026-05-02T00:00:00Z'),
    }),
    baseRecord({
      id: 'rejected-match',
      status: 'rejected',
      title: 'Mango rejected note',
      content: 'Should never appear.',
      summary: 'Should never appear.',
      updatedAt: new Date('2026-05-04T00:00:00Z'),
      approvedByUserId: null,
      rejectedByUserId: 'user_2',
      approvedAt: null,
      rejectedAt: new Date('2026-05-04T00:00:00Z'),
    }),
  ], 'mango voice');

  assert.deepEqual(result.selectedIds, ['approved-match']);
  assert.match(result.block, /<shared_memory scope="brand">/);
  assert.match(result.block, /\[voice\] Mango tone of voice: Warm farmer-friendly language for mango campaigns\./);
  assert.doesNotMatch(result.block, /Rice seasonal plan/);
  assert.doesNotMatch(result.block, /Mango rejected note/);
});
