import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import {
  applyReadyTaskFlowPrompt,
  buildNeedsMoreInfoIntercept,
  buildReadyTaskFlowMessageMetadata,
  resolveTaskFlowRuntime,
} from '@/features/task-flows/server/runtime';

function createTextMessage(
  role: ChatMessage['role'],
  text: string,
  metadata?: ChatMessage['metadata'],
): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: 'text', text }],
    metadata: metadata ?? {},
  } as ChatMessage;
}

test('resolveTaskFlowRuntime returns a needs_more_info intercept contract for vague diagnosis prompts', async () => {
  const runtime = await resolveTaskFlowRuntime({
    channel: 'web',
    lastUserPrompt: 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย',
    messages: [createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย')],
    activeSkillIds: [],
    activeSkillNames: [],
  });

  assert.equal(runtime.locale, 'th-TH');
  assert.equal(runtime.decision.status, 'needs_more_info');
  if (runtime.decision.status !== 'needs_more_info') return;

  const intercept = buildNeedsMoreInfoIntercept(runtime.decision);
  assert.match(intercept.assistantText, /เป็นพืชอะไร/);
  assert.equal(intercept.messageMetadata.taskFlow?.flowKey, 'agriculture.diagnosis');
  assert.deepEqual(intercept.messageMetadata.taskFlow?.missingSlots, ['crop_name']);
});

test('resolveTaskFlowRuntime plus metadata supports second-turn ready diagnosis flow', async () => {
  const firstRuntime = await resolveTaskFlowRuntime({
    channel: 'web',
    lastUserPrompt: 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย',
    messages: [createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย')],
    activeSkillIds: [],
    activeSkillNames: [],
  });
  assert.equal(firstRuntime.decision.status, 'needs_more_info');
  if (firstRuntime.decision.status !== 'needs_more_info') return;

  const secondRuntime = await resolveTaskFlowRuntime({
    channel: 'web',
    lastUserPrompt: 'มะเขือเทศ',
    messages: [
      createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย'),
      createTextMessage('assistant', firstRuntime.decision.followUpQuestion, buildNeedsMoreInfoIntercept(firstRuntime.decision).messageMetadata),
      createTextMessage('user', 'มะเขือเทศ'),
    ],
    activeSkillIds: [],
    activeSkillNames: [],
  });

  assert.equal(secondRuntime.decision.status, 'ready');
  if (secondRuntime.decision.status !== 'ready') return;

  const metadata = buildReadyTaskFlowMessageMetadata(secondRuntime.decision);
  assert.equal(metadata.taskFlow?.status, 'ready');
  assert.equal(metadata.taskFlow?.slots.crop_name, 'มะเขือเทศ');
});

test('applyReadyTaskFlowPrompt makes agriculture advisory and lesson plans structured', () => {
  const agriculturePrompt = applyReadyTaskFlowPrompt({
    baseSystemPrompt: 'Base prompt',
    locale: 'en-US',
    decision: {
      status: 'ready',
      flowKey: 'agriculture.diagnosis',
      confidence: 0.8,
      source: 'rule',
      outputTemplateKey: 'agriculture.diagnosis',
      slots: {
        crop_name: 'Tomato',
        symptoms: 'yellow leaves',
      },
    },
  });

  const lessonPlanPrompt = applyReadyTaskFlowPrompt({
    baseSystemPrompt: 'Base prompt',
    locale: 'en-US',
    decision: {
      status: 'ready',
      flowKey: 'education.lesson_plan',
      confidence: 0.8,
      source: 'rule',
      outputTemplateKey: 'common.summary',
      slots: {
        grade_level: 'Grade 5',
        subject: 'Science',
        duration: '50 minutes',
      },
    },
  });

  assert.match(agriculturePrompt, /advisory guidance/i);
  assert.match(agriculturePrompt, /When to seek human help:/);
  assert.match(lessonPlanPrompt, /Learning objectives:/);
  assert.match(lessonPlanPrompt, /Teaching sequence:/);
});
