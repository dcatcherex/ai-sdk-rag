import assert from 'node:assert/strict';
import test from 'node:test';

import type { CaseWorkspaceCase, CaseWorkspaceCaseContext } from './types';

function makeCase(overrides: Partial<CaseWorkspaceCase> = {}): CaseWorkspaceCase {
  return {
    id: 'case-1',
    profileId: 'profile-1',
    name: 'Invoice dispute follow-up',
    status: 'waiting',
    priority: 'high',
    data: {
      summary: 'Customer is waiting for the revised invoice.',
      nextAction: 'Send revised invoice PDF',
      source: 'line',
      lineUserId: 'line-1',
      channelId: 'channel-1',
      lastContactAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

test('detectCaseWorkspaceIntakeSignal recognizes intake-like messages', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { detectCaseWorkspaceIntakeSignal } = require('./service') as typeof import('./service');
  assert.equal(detectCaseWorkspaceIntakeSignal('Need help with a new complaint from customer'), true);
  assert.equal(detectCaseWorkspaceIntakeSignal('ขอติดตามสถานะเคสนี้หน่อย'), true);
  assert.equal(detectCaseWorkspaceIntakeSignal('hello there'), false);
});

test('detectCaseWorkspaceFollowUpSignal recognizes Thai follow-up messages', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { detectCaseWorkspaceFollowUpSignal } = require('./service') as typeof import('./service');
  assert.equal(detectCaseWorkspaceFollowUpSignal('ส่งเอกสารแล้ว ขออัปเดตสถานะ'), true);
  assert.equal(detectCaseWorkspaceFollowUpSignal('thanks'), false);
});

test('scoreCaseWorkspaceMatch prioritizes same LINE user and channel', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { scoreCaseWorkspaceMatch } = require('./service') as typeof import('./service');
  const strong = scoreCaseWorkspaceMatch({
    caseRecord: makeCase(),
    userMessage: 'status update on invoice',
    lineUserId: 'line-1',
    channelId: 'channel-1',
  });
  const weak = scoreCaseWorkspaceMatch({
    caseRecord: makeCase({
      data: {
        source: 'line',
        lineUserId: 'line-2',
        channelId: 'channel-2',
      },
    }),
    userMessage: 'status update on invoice',
    lineUserId: 'line-1',
    channelId: 'channel-1',
  });

  assert.equal(strong > weak, true);
});

test('assigned-to-me case filtering only matches the current assignee', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { filterCasesByInput } = require('./service') as typeof import('./service');
  const results = filterCasesByInput(
    [
      makeCase({
        id: 'case-1',
        name: 'Assigned to me',
        data: {
          status: 'waiting',
          priority: 'high',
          assigneeUserId: 'user-1',
        },
      }),
      makeCase({
        id: 'case-2',
        name: 'Assigned to someone else',
        data: {
          status: 'waiting',
          priority: 'high',
          assigneeUserId: 'user-2',
        },
      }),
    ],
    {
      assignedToMe: true,
      limit: 25,
    },
    { userId: 'user-1' },
  );

  assert.deepEqual(results.map((item: CaseWorkspaceCase) => item.id), ['case-1']);
});

test('buildCaseWorkspaceDashboardData returns aging metrics and reminders', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { buildCaseWorkspaceDashboardData } = require('./service') as typeof import('./service');

  const dashboard = buildCaseWorkspaceDashboardData({
    profile: {
      id: 'profile-1',
      domain: 'general',
      name: 'Workspace',
      description: null,
      locale: 'th-TH',
      status: 'active',
      data: {},
    },
    cases: [
      makeCase({
        id: 'case-1',
        status: 'waiting',
        priority: 'urgent',
        data: {
          lastContactAt: '2026-04-15T00:00:00.000Z',
          assigneeUserId: 'user-1',
          dueAt: '2026-05-20T00:00:00.000Z',
        },
      }),
      makeCase({
        id: 'case-2',
        status: 'in_progress',
        priority: 'normal',
        data: {
          lastContactAt: '2026-05-06T00:00:00.000Z',
        },
      }),
    ],
    tasks: [
      {
        id: 'task-1',
        caseId: 'case-1',
        title: 'Overdue follow-up',
        status: 'todo',
        dueAt: '2026-05-01T00:00:00.000Z',
        assigneeUserId: 'user-1',
        data: {},
      },
    ],
  });

  assert.equal(dashboard.metrics.totalCases, 2);
  assert.equal(dashboard.metrics.waitingCases, 1);
  assert.equal(dashboard.metrics.overdueTasks, 1);
  assert.equal(dashboard.metrics.unassignedCases, 1);
  assert.equal(dashboard.metrics.agingCounts.critical >= 1, true);
  assert.equal(dashboard.reminders.length >= 2, true);
});

test('buildCaseWorkspaceCsvExport includes case and task rows', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { buildCaseWorkspaceCsvExport } = require('./service') as typeof import('./service');

  const csv = buildCaseWorkspaceCsvExport({
    profile: {
      id: 'profile-1',
      domain: 'general',
      name: 'Workspace',
      description: null,
      locale: 'th-TH',
      status: 'active',
      data: {},
    },
    cases: [
      makeCase({
        id: 'case-1',
        name: 'Invoice dispute',
        data: {
          source: 'line',
          assigneeUserId: 'user-1',
        },
      }),
    ],
    tasks: [
      {
        id: 'task-1',
        caseId: 'case-1',
        title: 'Send update',
        status: 'doing',
        dueAt: '2026-05-08T00:00:00.000Z',
        assigneeUserId: 'user-1',
        data: {},
      },
    ],
  });

  assert.match(csv, /profile_id,profile_name,case_id/);
  assert.match(csv, /Invoice dispute/);
  assert.match(csv, /Send update/);
});

test('renderCaseWorkspacePromptBlock renders matched case context safely', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { renderCaseWorkspacePromptBlock } = require('./service') as typeof import('./service');
  const context: CaseWorkspaceCaseContext = {
    profile: {
      id: 'profile-1',
      domain: 'general',
      name: 'Workspace',
      description: null,
      locale: 'th-TH',
      status: 'active',
      data: {},
    },
    contact: {
      id: 'contact-1',
      profileId: 'profile-1',
      name: 'Acme Co.',
      status: 'active',
      kind: 'contact',
      data: {},
    },
    case: makeCase(),
    tasks: [
      {
        id: 'task-1',
        caseId: 'case-1',
        title: 'Send revised invoice',
        status: 'todo',
        dueAt: '2026-05-07T10:00:00.000Z',
        data: {},
      },
    ],
    timeline: [
      {
        id: 'note-1',
        caseId: 'case-1',
        kind: 'note',
        title: 'Customer asked for status',
        body: 'Need an answer by tomorrow',
        createdAt: '2026-05-06T09:00:00.000Z',
        data: {},
      },
    ],
  };

  const block = renderCaseWorkspacePromptBlock({
    context,
    shouldSuggestCreate: false,
  });

  assert.match(block, /<case_workspace_context>/);
  assert.match(block, /matched_case_name: Invoice dispute follow-up/);
  assert.match(block, /write_policy:/);
});

test('renderCaseWorkspacePromptBlock can emit intake hint without a matched case', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { renderCaseWorkspacePromptBlock } = require('./service') as typeof import('./service');
  const block = renderCaseWorkspacePromptBlock({
    context: null,
    shouldSuggestCreate: true,
  });

  assert.match(block, /<case_workspace_intake_hint>/);
  assert.match(block, /explicit user confirmation/i);
});

test('pending case draft round-trips through metadata helpers', () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const {
    buildCreateCaseDraft,
    readPendingCaseWorkspaceDraft,
  } = require('./service') as typeof import('./service');

  const draft = buildCreateCaseDraft({
    userText: 'Customer says the delivery is missing and wants help urgently.',
    profileId: 'profile-1',
  });

  const parsed = readPendingCaseWorkspaceDraft({
    pendingCaseWorkspaceDraft: draft,
  });

  assert.equal(parsed?.draftId, draft.draftId);
  assert.equal(parsed?.action, 'create_case');
  assert.equal(parsed?.profileId, 'profile-1');
});
