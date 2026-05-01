import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResponseAuditSummary } from '@/features/response-format/server/audit';

test('buildResponseAuditSummary captures response-format telemetry', () => {
  const summary = buildResponseAuditSummary(
    {
      intent: 'approval_request',
      formats: ['workflow', 'card', 'quick_replies'],
      locale: 'en-US',
      bodyText: 'Approval request created.',
      quickReplies: [
        { actionType: 'message', label: 'Ask human', text: 'Ask human' },
      ],
      card: {
        templateKey: 'common.approval_request',
        altText: 'Approval request',
        data: {},
        fallbackText: 'Approval request created.',
      },
      workflow: {
        type: 'approval',
        priority: 'normal',
        reason: 'Approval request created.',
      },
    },
    { renderFallbackUsed: true, parseConfidence: 0.85 },
  );

  assert.equal(summary.responseIntent, 'approval_request');
  assert.deepEqual(summary.responseFormats, ['workflow', 'card', 'quick_replies']);
  assert.equal(summary.templateKey, 'common.approval_request');
  assert.equal(summary.quickReplyCount, 1);
  assert.equal(summary.escalationCreated, true);
  assert.equal(summary.workflowType, 'approval');
  assert.equal(summary.renderFallbackUsed, true);
  assert.equal(summary.parseConfidence, 0.85);
});
