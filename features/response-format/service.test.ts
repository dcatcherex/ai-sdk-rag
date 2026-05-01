import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFallbackResponsePlan,
  buildResponsePlan,
  renderResponseForLine,
  renderResponseForWeb,
} from '@/features/response-format';

test('buildFallbackResponsePlan marks short replies as plain text', () => {
  const plan = buildFallbackResponsePlan({
    text: 'พร้อมช่วยครับ',
    locale: 'th-TH',
  });

  assert.deepEqual(plan.formats, ['plain_text']);
  assert.equal(plan.bodyText, 'พร้อมช่วยครับ');
});

test('buildFallbackResponsePlan marks bullet replies as structured text with quick replies', () => {
  const plan = buildFallbackResponsePlan({
    text: '- Step one\n- Step two',
    locale: 'th-TH',
    quickReplies: [
      {
        actionType: 'message',
        label: 'ทำต่อ',
        text: 'ทำต่อ',
      },
    ],
  });

  assert.deepEqual(plan.formats, ['structured_text', 'quick_replies']);
  assert.equal(plan.quickReplies?.length, 1);
});

test('renderResponseForLine preserves the existing bullet-heavy flex fallback', () => {
  const plan = buildFallbackResponsePlan({
    text: 'สรุปผล\n• ข้อแรก\n• ข้อสอง',
    locale: 'th-TH',
  });

  const messages = renderResponseForLine(plan);

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.type, 'flex');
});

test('renderResponseForLine truncates quick reply labels to LINE limits', () => {
  const plan = buildFallbackResponsePlan({
    text: 'เลือกสิ่งที่ต้องการทำต่อ',
    locale: 'th-TH',
    quickReplies: [
      {
        actionType: 'message',
        label: 'ตัวเลือกที่มีความยาวเกินขีดจำกัดของไลน์',
        text: 'ตัวเลือกที่มีความยาวเกินขีดจำกัดของไลน์',
      },
    ],
  });

  const messages = renderResponseForLine(plan);
  const lastMessage = messages.at(-1);

  assert.equal(lastMessage?.type, 'text');
  const quickReplyItems = lastMessage?.quickReply?.items;
  assert.ok(quickReplyItems && quickReplyItems.length > 0);
  const quickReplyLabel = quickReplyItems[0]?.action?.label;
  assert.equal(quickReplyLabel?.length, 20);
});

test('buildResponsePlan prefers structured tool result mapping for weather forecasts', () => {
  const plan = buildResponsePlan({
    text: '',
    locale: 'en-US',
    toolResults: [
      {
        toolName: 'weather',
        result: {
          kind: 'weather_forecast',
          location: { label: 'Chiang Mai, Thailand' },
          current: { temperatureC: 33 },
          riskSummary: { headline: 'Rain is likely. Plan field work around wet periods.' },
        },
      },
    ],
  });

  assert.equal(plan.intent, 'risk_summary');
  assert.equal(plan.formats[0], 'card');
  assert.equal(plan.card?.templateKey, 'agriculture.weather_risk');
  assert.match(plan.bodyText, /Chiang Mai/);
  assert.equal(plan.metadata?.toolKind, 'weather_forecast');
});

test('buildResponsePlan maps record save tool results to record intent', () => {
  const plan = buildResponsePlan({
    text: '',
    locale: 'th-TH',
    toolResults: [
      {
        toolName: 'log_activity',
        result: {
          kind: 'record_saved',
          activity: 'Applied urea',
          date: '2026-05-01',
          recordId: 'rec-123',
        },
      },
    ],
  });

  assert.equal(plan.intent, 'record_saved');
  assert.equal(plan.formats[0], 'card');
  assert.equal(plan.card?.templateKey, 'common.confirmation');
  assert.match(plan.bodyText, /บันทึก/);
  assert.equal(plan.metadata?.toolKind, 'record_saved');
});

test('renderResponseForLine renders registry-backed cards as flex messages', () => {
  const plan = buildResponsePlan({
    text: '',
    locale: 'en-US',
    toolResults: [
      {
        toolName: 'weather',
        result: {
          kind: 'weather_forecast',
          location: { label: 'Chiang Mai, Thailand' },
          current: { temperatureC: 33, humidityPercent: 78, precipitationMm: 7 },
          daily: [{ precipitationProbabilityPercent: 60 }],
          riskSummary: { headline: 'Rain is likely. Plan field work around wet periods.' },
        },
      },
    ],
  });

  const messages = renderResponseForLine(plan);

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.type, 'flex');
});

test('renderResponseForLine falls back to text when card data is incomplete', () => {
  const messages = renderResponseForLine({
    intent: 'record_saved',
    locale: 'en-US',
    bodyText: 'Saved successfully.',
    formats: ['card'],
    card: {
      templateKey: 'agriculture.record_entry',
      altText: 'Record saved',
      data: { activity: 'Applied urea' },
      fallbackText: 'Saved successfully.',
    },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.type, 'text');
});

test('buildResponsePlan maps approval results to approval workflow and card rendering', () => {
  const plan = buildResponsePlan({
    text: '',
    locale: 'en-US',
    toolResults: [
      {
        toolName: 'create_approval_request',
        result: {
          kind: 'approval_request_created',
          approvalRequestId: 'apr-123',
          contentPieceId: 'piece-123',
          contentPieceTitle: 'June campaign post',
          assigneeName: 'Nok',
          status: 'pending',
          dueAt: '2026-05-05T09:00:00.000Z',
        },
      },
    ],
  });

  assert.equal(plan.intent, 'approval_request');
  assert.equal(plan.formats[0], 'workflow');
  assert.equal(plan.card?.templateKey, 'common.approval_request');
  assert.equal(plan.workflow?.type, 'approval');
  assert.equal(plan.workflow?.data?.approvalRequestId, 'apr-123');
});

test('renderResponseForWeb returns rendered registry-backed card payloads', () => {
  const rendered = renderResponseForWeb(
    buildResponsePlan({
      text: '',
      locale: 'en-US',
      toolResults: [
        {
          toolName: 'create_approval_request',
          result: {
            kind: 'approval_request_created',
            approvalRequestId: 'apr-123',
            contentPieceId: 'piece-123',
            contentPieceTitle: 'June campaign post',
            assigneeName: 'Nok',
            status: 'pending',
            dueAt: '2026-05-05T09:00:00.000Z',
          },
        },
      ],
    }),
  );

  assert.equal(rendered.card?.hasRenderer, true);
  assert.equal(rendered.card?.rendered?.tone, 'warning');
  assert.equal(rendered.card?.rendered?.fields?.[0]?.label, 'Status');
});

test('buildResponsePlan creates a human-review workflow for explicit human help requests', () => {
  const plan = buildResponsePlan({
    text: 'Severity: High\nPlease pause field work and consult an officer today.',
    userText: 'I want a human to check this case',
    locale: 'en-US',
    workflowContext: {
      actorCapabilities: ['workflow.request_human_review'],
      scopeType: 'brand',
      scopeId: 'brand-123',
      sourceThreadId: 'thread-123',
      channel: 'line',
    },
  });

  assert.equal(plan.workflow?.type, 'human_review');
  assert.equal(plan.workflow?.priority, 'urgent');
  assert.equal(plan.workflow?.scopeType, 'brand');
  assert.equal(plan.workflow?.status, 'suggested');
  assert.equal(plan.quickReplies?.[0]?.actionType, 'postback');
  assert.match(plan.quickReplies?.[0]?.postbackData ?? '', /^workflow:human_review:request:/);
});

test('buildResponsePlan marks restricted human-review workflows when actor lacks review capability', () => {
  const plan = buildResponsePlan({
    text: 'Severity: High\nPlease consult a professional immediately.',
    locale: 'en-US',
    workflowContext: {
      actorCapabilities: [],
      scopeType: 'brand',
      scopeId: 'brand-123',
    },
  });

  assert.equal(plan.workflow?.type, 'human_review');
  assert.equal(plan.workflow?.status, 'restricted');
  assert.equal(plan.quickReplies?.length ?? 0, 0);
});
