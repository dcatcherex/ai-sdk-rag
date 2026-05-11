import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRichMessageDataSchema } from '@/features/rich-messages/dynamic';
import { renderRichMessage, renderRichMessageTemplate } from '@/features/rich-messages/service';
import { renderRichMessageForLine } from '@/features/rich-messages/adapters/line';
import { renderRichMessageAsWebResponseCard } from '@/features/rich-messages/adapters/web';

test('renderRichMessage builds an agriculture diagnosis instance', () => {
  const result = renderRichMessage({
    templateKey: 'agriculture.diagnosis',
    channel: 'web',
    data: {
      crop_name: 'Tomato',
      diagnosis: 'Leaf blight',
      severity: 'High',
      recommendation: 'Remove infected leaves and monitor moisture.',
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.instance.templateKey, 'agriculture.diagnosis');
  assert.equal(result.instance.resolvedLayout.title, 'Tomato');
  assert.equal(result.instance.resolvedLayout.sections?.[1]?.tone, 'danger');
  assert.match(result.instance.fallbackText, /Leaf blight/);
});

test('renderRichMessageForLine returns a flex message for diagnosis', () => {
  const rendered = renderRichMessage({
    templateKey: 'agriculture.diagnosis',
    channel: 'line',
    data: {
      crop_name: 'Tomato',
      diagnosis: 'Leaf blight',
      severity: 'Medium',
      recommendation: 'Prune affected leaves.',
    },
  });

  assert.equal(rendered.ok, true);
  if (!rendered.ok) {
    return;
  }

  const message = renderRichMessageForLine(rendered.instance);
  assert.equal(message.type, 'flex');
  assert.equal(message.contents.type, 'bubble');
});

test('renderRichMessageAsWebResponseCard converts approval request sections into fields', () => {
  const rendered = renderRichMessage({
    templateKey: 'common.approval_request',
    channel: 'web',
    data: {
      title: 'June campaign post',
      summary: 'Needs approval before scheduling.',
      status: 'pending',
      assigneeName: 'Nok',
      dueAt: '2026-05-05T09:00:00.000Z',
    },
  });

  assert.equal(rendered.ok, true);
  if (!rendered.ok) {
    return;
  }

  const card = renderRichMessageAsWebResponseCard(rendered.instance);
  assert.equal(card.tone, 'warning');
  assert.equal(card.fields?.[0]?.label, 'Status');
  assert.equal(card.fields?.[0]?.value, 'pending');
});

test('renderRichMessage supports forecast summary templates with optional fields', () => {
  const rendered = renderRichMessage({
    templateKey: 'agriculture.forecast_7day',
    channel: 'web',
    data: {
      title: '7-day forecast',
      summary: 'Rain likely on days 3-4. Delay field spraying.',
    },
  });

  assert.equal(rendered.ok, true);
  if (!rendered.ok) {
    return;
  }

  assert.equal(rendered.instance.altText, '7-day forecast');
  assert.match(rendered.instance.fallbackText, /Delay field spraying/);
});

test('renderRichMessageTemplate renders a database-backed style template definition', () => {
  const rendered = renderRichMessageTemplate({
    key: 'custom.follow_up',
    title: 'Custom Follow Up',
    category: 'other',
    intent: 'client_follow_up',
    schema: buildRichMessageDataSchema({
      fields: [
        { key: 'title', type: 'string', required: true },
        { key: 'summary', type: 'string', required: true },
      ],
    }),
    supportedChannels: ['line', 'web'],
    layout: {
      type: 'card',
      title: '{{title}}',
      summary: '{{summary}}',
    },
    fallback: {
      altText: '{{title}}',
    },
  }, {
    channel: 'web',
    data: {
      title: 'Follow up tomorrow',
      summary: 'Call customer after delivery window closes.',
    },
  });

  assert.equal(rendered.ok, true);
  if (!rendered.ok) {
    return;
  }

  assert.equal(rendered.instance.templateKey, 'custom.follow_up');
  assert.equal(rendered.instance.altText, 'Follow up tomorrow');
});
