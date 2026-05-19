import assert from 'node:assert/strict';
import test from 'node:test';

import { getToolApprovalId } from '@/components/message-renderer/types';

test('getToolApprovalId uses the AI SDK approval id, not the tool call id', () => {
  const part = {
    type: 'tool-log_activity',
    toolCallId: 'tool-call-123',
    state: 'approval-requested',
    input: { activity: 'apply fertilizer' },
    approval: { id: 'approval-456' },
  };

  assert.equal(getToolApprovalId(part as never), 'approval-456');
});

test('getToolApprovalId ignores non-pending tool parts', () => {
  const part = {
    type: 'tool-log_activity',
    toolCallId: 'tool-call-123',
    state: 'approval-responded',
    input: { activity: 'apply fertilizer' },
    approval: { id: 'approval-456', approved: true },
  };

  assert.equal(getToolApprovalId(part as never), null);
});
