import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFallbackDiagnosisContract,
  buildToolResultsFallbackContext,
  buildAgentRunModelMessages,
  collectToolImageUrls,
  containsLikelyUnexpectedEnglish,
  extractNamedToolPayload,
  formatFarmRecordSummary,
  getLastUserPromptFromRunMessages,
  hasRequiredHeadings,
  inferFarmRecordSummaryRequest,
  looksLikeDiagnosisRequest,
  looksLikeRecordSummaryRequest,
} from './run-helpers';

test('getLastUserPromptFromRunMessages uses the latest non-empty user text', () => {
  const prompt = getLastUserPromptFromRunMessages([
    { role: 'user', content: 'first question' },
    { role: 'assistant', content: 'first answer' },
    { role: 'user', content: '', parts: [{ type: 'text', text: 'latest question' }] },
  ]);

  assert.equal(prompt, 'latest question');
});

test('buildAgentRunModelMessages normalizes plain text into text parts', () => {
  const normalized = buildAgentRunModelMessages([
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: '', parts: [{ type: 'text', text: 'world' }] },
  ]);

  assert.deepEqual(normalized, [
    { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    { role: 'assistant', parts: [{ type: 'text', text: 'world' }] },
  ]);
});

test('collectToolImageUrls merges image outputs from canonical tool result shapes', () => {
  const urls = collectToolImageUrls([
    { result: { imageUrl: 'https://example.com/a.png' } },
    { output: { imageUrls: ['https://example.com/b.png', 'https://example.com/c.png'] } },
    { result: { outputUrls: ['https://example.com/d.png'] } },
  ]);

  assert.deepEqual(urls, [
    'https://example.com/a.png',
    'https://example.com/b.png',
    'https://example.com/c.png',
    'https://example.com/d.png',
  ]);
});

test('buildToolResultsFallbackContext serializes tool names and payloads', () => {
  const context = buildToolResultsFallbackContext([
    { toolName: 'weather', result: { location: 'Chiang Mai', source: 'Open-Meteo' } },
    { dynamic: 'record_keeper', output: { ok: true, message: 'Saved' } },
  ]);

  assert.match(context, /weather/);
  assert.match(context, /Chiang Mai/);
  assert.match(context, /record_keeper/);
  assert.match(context, /Saved/);
});

test('extractNamedToolPayload returns the matching tool payload', () => {
  const payload = extractNamedToolPayload([
    { toolName: 'weather', result: { ok: true } },
    { toolName: 'summarize_activity_records', result: { total: 2 } },
  ], ['summarize_activity_records']);

  assert.deepEqual(payload, { total: 2 });
});

test('formatFarmRecordSummary renders stable Thai headings for empty records', () => {
  const summary = formatFarmRecordSummary(
    { period: 'week', total: 0, totalCost: 0, totalIncome: 0, records: [] },
    true,
  );

  assert.ok(summary);
  assert.equal(
    hasRequiredHeadings(summary ?? '', [
      'สรุปสัปดาห์นี้:',
      'งานที่ทำ:',
      'ค่าใช้จ่ายหรือผลผลิตที่บันทึก:',
      'สิ่งที่ควรทำต่อ:',
    ]),
    true,
  );
});

test('intent helpers detect record summary and diagnosis prompts', () => {
  assert.equal(looksLikeRecordSummaryRequest('สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย'), true);
  assert.equal(looksLikeDiagnosisRequest('ใบมะเขือเทศเป็นจุดสีน้ำตาล ช่วยดูหน่อย'), true);
});

test('inferFarmRecordSummaryRequest detects farm weekly summary prompts', () => {
  assert.deepEqual(inferFarmRecordSummaryRequest('สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย'), {
    contextType: 'farm',
    period: 'week',
  });
});

test('buildFallbackDiagnosisContract returns the Thai diagnosis headings', () => {
  const contract = buildFallbackDiagnosisContract('ใบมะเขือเทศเป็นจุดสีน้ำตาล', true);

  assert.equal(
    hasRequiredHeadings(contract, [
      'ปัญหาที่น่าจะเป็น:',
      'ความมั่นใจ:',
      'ระดับความรุนแรง:',
      'ควรทำทันที:',
      'ป้องกันรอบต่อไป:',
      'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
    ]),
    true,
  );
});

test('containsLikelyUnexpectedEnglish detects english-heavy output', () => {
  assert.equal(
    containsLikelyUnexpectedEnglish(
      'Early Blight caused by Alternaria solani with Mancozeb and Chlorothalonil treatment guidance',
    ),
    true,
  );
});
