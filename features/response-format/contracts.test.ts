import assert from 'node:assert/strict';
import test from 'node:test';

import { RESPONSE_INTENT_REGISTRY } from '@/features/response-format';
import { parseSkillMarkdown } from '@/features/skills/server/parser';

test('response intent registry covers common multi-profession intents', () => {
  assert.equal(RESPONSE_INTENT_REGISTRY.diagnosis.label, 'Diagnosis');
  assert.equal(RESPONSE_INTENT_REGISTRY.lesson_plan.label, 'Lesson Plan');
  assert.equal(RESPONSE_INTENT_REGISTRY.patient_follow_up.label, 'Patient Follow Up');
  assert.equal(RESPONSE_INTENT_REGISTRY.client_follow_up.label, 'Client Follow Up');
  assert.equal(RESPONSE_INTENT_REGISTRY.content_plan.label, 'Content Plan');
});

test('parser handles agriculture, education, clinic, sales, and creator response contracts', () => {
  const agriculture = parseSkillMarkdown(`---
name: agriculture-diagnosis
description: Help with crop diagnosis
response-contracts:
  - intent: diagnosis
    default-format: structured_text
    card-template: agriculture.diagnosis
    escalation: supported
---
Diagnose crop issues carefully.`);

  const education = parseSkillMarkdown(`## Response Contracts

- intent: lesson_plan
- default-format: card
- card-template: education.lesson_plan
- required sections: objective, activities, assessment`);

  const clinic = parseSkillMarkdown(`## Response Contracts

- intent: patient_follow_up
- default-format: structured_text
- card-template: clinic.follow_up
- escalation: required`);

  const sales = parseSkillMarkdown(`## Response Contracts

- intent: client_follow_up
- default-format: card
- card-template: sales.deal_update`);

  const creator = parseSkillMarkdown(`## Response Contracts

- intent: content_plan
- default-format: structured_text
- card-template: creator.content_plan`);

  assert.equal(agriculture.responseContracts[0]?.intent, 'diagnosis');
  assert.equal(education.responseContracts[0]?.intent, 'lesson_plan');
  assert.deepEqual(education.responseContracts[0]?.requiredSections, ['objective', 'activities', 'assessment']);
  assert.equal(clinic.responseContracts[0]?.escalation, 'required');
  assert.equal(sales.responseContracts[0]?.cardTemplate, 'sales.deal_update');
  assert.equal(creator.responseContracts[0]?.defaultFormat, 'structured_text');
});
