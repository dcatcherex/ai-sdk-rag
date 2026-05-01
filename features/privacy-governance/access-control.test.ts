import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveResponseWorkflowCapabilities } from '@/features/privacy-governance/access-control';

test('brand owners receive full response-workflow capabilities', () => {
  const capabilities = deriveResponseWorkflowCapabilities({
    isOwner: true,
    isAuthenticated: true,
  });

  assert.ok(capabilities.includes('workflow.request_human_review'));
  assert.ok(capabilities.includes('workflow.assign_reviewer'));
  assert.ok(capabilities.includes('workflow.view_review_queue'));
  assert.ok(capabilities.includes('workflow.resolve'));
  assert.ok(capabilities.includes('conversation.read_escalated'));
});

test('reviewers can access escalated workflows without assignment capability', () => {
  const capabilities = deriveResponseWorkflowCapabilities({
    workspaceRole: 'reviewer',
    isAuthenticated: true,
  });

  assert.ok(capabilities.includes('workflow.request_human_review'));
  assert.ok(capabilities.includes('workflow.view_review_queue'));
  assert.ok(capabilities.includes('workflow.resolve'));
  assert.ok(capabilities.includes('conversation.read_escalated'));
  assert.equal(capabilities.includes('workflow.assign_reviewer'), false);
});

test('writers keep only human-review request capability', () => {
  const capabilities = deriveResponseWorkflowCapabilities({
    workspaceRole: 'writer',
    isAuthenticated: true,
  });

  assert.deepEqual(capabilities, ['workflow.request_human_review']);
});
