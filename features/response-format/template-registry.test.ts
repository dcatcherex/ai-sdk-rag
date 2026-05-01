import assert from 'node:assert/strict';
import test from 'node:test';

import { getResponseTemplateByKey, listResponseTemplates } from '@/features/response-format';

test('template registry exposes common and agriculture templates', () => {
  const templates = listResponseTemplates();
  const keys = templates.map((template) => template.key);

  assert.ok(keys.includes('common.confirmation'));
  assert.ok(keys.includes('common.summary'));
  assert.ok(keys.includes('common.approval_request'));
  assert.ok(keys.includes('common.escalation'));
  assert.ok(keys.includes('agriculture.weather_risk'));
  assert.ok(keys.includes('agriculture.record_entry'));
});

test('agriculture weather template is mapped from the registry', () => {
  const template = getResponseTemplateByKey('agriculture.weather_risk');

  assert.ok(template);
  assert.equal(template?.intent, 'risk_summary');
  assert.ok(template?.supportedChannels.includes('line'));
  assert.ok(template?.supportedChannels.includes('web'));
  assert.ok(template?.renderWeb);
});
