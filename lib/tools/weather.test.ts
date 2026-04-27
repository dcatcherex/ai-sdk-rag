import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeatherRiskSummary } from './weather';

test('buildWeatherRiskSummary flags high heat and rain risk', () => {
  const result = buildWeatherRiskSummary({
    currentTempC: 35,
    currentRainMm: 2,
    currentWindKmh: 12,
    dailyRainMm: [4, 12, 58],
    dailyRainProbability: [20, 55, 90],
    dailyMaxTempC: [36, 38, 37],
    dailyWindKmh: [18, 21, 24],
  });

  assert.equal(result.flags.some((flag) => flag.type === 'heat' && flag.level === 'high'), true);
  assert.equal(result.flags.some((flag) => flag.type === 'rain' && flag.level === 'high'), true);
});

test('buildWeatherRiskSummary stays calm when conditions are mild', () => {
  const result = buildWeatherRiskSummary({
    currentTempC: 29,
    currentRainMm: 0,
    currentWindKmh: 10,
    dailyRainMm: [0, 2, 1],
    dailyRainProbability: [10, 20, 15],
    dailyMaxTempC: [30, 31, 30],
    dailyWindKmh: [9, 12, 11],
  });

  assert.equal(result.flags.length, 0);
  assert.match(result.headline, /No major short-term field risks/i);
});
