import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLineAgricultureIntentByRegex } from './intent-router';

function intent(text: string, hasPendingFarmRecordDraft = false) {
  return resolveLineAgricultureIntentByRegex({ text, hasPendingFarmRecordDraft });
}

test('routes farm record summaries and lookups away from save-log', () => {
  assert.equal(intent('สรุปกิจกรรมฟาร์มสัปดาห์นี้ให้หน่อย').intent, 'farm_log_summary');
  assert.equal(intent('ดูบันทึกย้อนหลังให้หน่อย').intent, 'farm_log_summary');
});

test('routes market sell/hold questions to market intent', () => {
  const result = intent('ตอนนี้ควรขายมะเขือเทศเลยไหม หรือรออีกหน่อย');

  assert.equal(result.intent, 'market_decision');
  assert.equal(result.missing, undefined);
});

test('routes weather risk requests and requires location when missing', () => {
  const missingLocation = intent('เช็คสภาพอากาศและความเสี่ยงฟาร์ม 7 วัน');
  const withLocation = intent('เชียงใหม่ 7 วันนี้ฝนจะกระทบแปลงมะเขือเทศไหม ควรทำอะไร');

  assert.equal(missingLocation.intent, 'weather_risk');
  assert.deepEqual(missingLocation.missing, ['location']);
  assert.equal(withLocation.intent, 'weather_risk');
  assert.equal(withLocation.missing, undefined);
});

test('routes farm setup details away from save-log', () => {
  const result = intent('ฉันปลูกมะเขือเทศ 2 ไร่ที่แม่ริม เชียงใหม่ มีแปลงหลังบ้านกับโรงเรือน');

  assert.equal(result.intent, 'farm_profile_setup');
});

test('routes severe uncertain crop cases to diagnosis escalation path', () => {
  const result = intent('ใบในแปลงแตงโมเหี่ยวเร็วมาก ทั้งแปลงเริ่มเสียหายภายในสองวัน ควรฉีดยาอะไรแรง ๆ ดี');

  assert.equal(result.intent, 'plant_diagnosis');
});

test('routes concrete farm activity to save-log confirmation', () => {
  const result = intent('วันนี้ใส่ปุ๋ยยูเรีย 50 กก. ที่แปลงหลังบ้าน ค่าใช้จ่าย 850 บาท');

  assert.equal(result.intent, 'farm_log_create');
  assert.equal(result.missing, undefined);
});

test('routes pending confirmation replies only when a draft exists', () => {
  assert.equal(intent('ใช่', true).intent, 'confirm_pending');
  assert.equal(intent('ใช่').intent, 'unknown');
});
