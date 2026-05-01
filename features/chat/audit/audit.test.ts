import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChatRunOutputSummary } from '@/features/chat/audit/summary';

test('buildChatRunOutputSummary includes response-format observability fields', () => {
  const summary = buildChatRunOutputSummary({
    routeKind: 'text',
    followUpSuggestionCount: 2,
    memoryExtracted: true,
    responseFormat: {
      responseIntent: 'risk_summary',
      responseFormats: ['card', 'quick_replies'],
      templateKey: 'agriculture.weather_risk',
      quickReplyCount: 2,
      escalationCreated: false,
      workflowType: null,
      renderFallbackUsed: false,
      parseConfidence: null,
    },
  });

  assert.equal(summary.responseIntent, 'risk_summary');
  assert.deepEqual(summary.responseFormats, ['card', 'quick_replies']);
  assert.equal(summary.templateKey, 'agriculture.weather_risk');
  assert.equal(summary.quickReplyCount, 2);
  assert.equal(summary.escalationCreated, false);
  assert.equal(summary.renderFallbackUsed, false);
  assert.equal(summary.followUpSuggestionCount, 2);
});
