import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLinkedRichTemplateKeyForFlexTemplateName,
  inferFlexTemplateType,
  inferLinkedRichTemplateKey,
} from '@/features/line-oa/flex/linking';

test('getLinkedRichTemplateKeyForFlexTemplateName maps known AgriSpark templates', () => {
  assert.equal(
    getLinkedRichTemplateKeyForFlexTemplateName('agrispark-diagnosis-result'),
    'agriculture.diagnosis',
  );
  assert.equal(
    getLinkedRichTemplateKeyForFlexTemplateName('agrispark-weekly-summary'),
    'agriculture.weekly_summary',
  );
  assert.equal(getLinkedRichTemplateKeyForFlexTemplateName('custom-line-only-card'), null);
});

test('inferFlexTemplateType prefers explicit type and otherwise infers overrides from linkage', () => {
  assert.equal(
    inferFlexTemplateType({ templateType: 'line_only', richTemplateKey: 'agriculture.diagnosis' }),
    'line_only',
  );
  assert.equal(
    inferFlexTemplateType({ richTemplateKey: 'agriculture.diagnosis' }),
    'line_override',
  );
  assert.equal(
    inferFlexTemplateType({ name: 'agrispark-record-entry' }),
    'line_override',
  );
  assert.equal(
    inferFlexTemplateType({ name: 'custom-line-only-card' }),
    'line_only',
  );
});

test('inferLinkedRichTemplateKey uses explicit keys before name-based fallback', () => {
  assert.equal(
    inferLinkedRichTemplateKey({
      richTemplateKey: 'common.summary',
      name: 'agrispark-diagnosis-result',
    }),
    'common.summary',
  );
  assert.equal(
    inferLinkedRichTemplateKey({ name: 'agrispark-weather-risk' }),
    'agriculture.weather_risk',
  );
  assert.equal(inferLinkedRichTemplateKey({ name: 'custom-line-only-card' }), null);
});
