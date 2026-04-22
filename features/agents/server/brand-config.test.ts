import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAgentBrandConfig } from './brand-config';

test('none mode clears brand-specific settings', () => {
  const result = normalizeAgentBrandConfig({
    brandId: 'brand-1',
    brandMode: 'none',
    brandAccessPolicy: 'specific_brand',
    requiresBrandForRun: true,
    fallbackBehavior: 'block_run',
  });

  assert.equal(result.brandId, null);
  assert.equal(result.brandMode, 'none');
  assert.equal(result.brandAccessPolicy, 'no_brand');
  assert.equal(result.requiresBrandForRun, false);
  assert.equal(result.fallbackBehavior, 'block_run');
});

test('no_brand access policy forces none mode', () => {
  const result = normalizeAgentBrandConfig({
    brandId: 'brand-1',
    brandMode: 'optional',
    brandAccessPolicy: 'no_brand',
    requiresBrandForRun: true,
  });

  assert.equal(result.brandId, null);
  assert.equal(result.brandMode, 'none');
  assert.equal(result.brandAccessPolicy, 'no_brand');
  assert.equal(result.requiresBrandForRun, false);
});

test('locked mode requires brandId', () => {
  assert.throws(
    () =>
      normalizeAgentBrandConfig({
        brandMode: 'locked',
        brandAccessPolicy: 'specific_brand',
      }),
    /brandId is required when brandMode is "locked"/,
  );
});

test('suggested mode requires brandId', () => {
  assert.throws(
    () =>
      normalizeAgentBrandConfig({
        brandMode: 'suggested',
      }),
    /brandId is required when brandMode is "suggested"/,
  );
});

test('specific_brand access policy requires brandId', () => {
  assert.throws(
    () =>
      normalizeAgentBrandConfig({
        brandMode: 'optional',
        brandAccessPolicy: 'specific_brand',
      }),
    /brandId is required when brandAccessPolicy is "specific_brand"/,
  );
});

test('locked mode normalizes to specific brand and requires run', () => {
  const result = normalizeAgentBrandConfig({
    brandId: 'brand-1',
    brandMode: 'locked',
    brandAccessPolicy: 'any_accessible',
    requiresBrandForRun: false,
    fallbackBehavior: 'ask_or_continue',
  });

  assert.equal(result.brandId, 'brand-1');
  assert.equal(result.brandMode, 'locked');
  assert.equal(result.brandAccessPolicy, 'specific_brand');
  assert.equal(result.requiresBrandForRun, true);
});
