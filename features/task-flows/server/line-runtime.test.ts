import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import { resolveLineTaskFlowAction } from '@/features/task-flows/server/line-runtime';

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

test('resolveLineTaskFlowAction returns follow_up for vague agriculture diagnosis', async () => {
  const result = await resolveLineTaskFlowAction({
    lastUserPrompt: 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย',
    messages: [createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย')],
    activeSkillIds: [],
    activeSkillNames: [],
  });

  assert.equal(result.kind, 'follow_up');
  if (result.kind !== 'follow_up') return;
  assert.match(result.assistantText, /เป็นพืชอะไร/);
});

test('resolveLineTaskFlowAction returns ready for education lesson plans', async () => {
  const result = await resolveLineTaskFlowAction({
    lastUserPrompt: 'ช่วยทำแผนการสอน ป.4 วิทยาศาสตร์ เรื่อง วงจรชีวิตพืช 50 นาที',
    messages: [createTextMessage('user', 'ช่วยทำแผนการสอน ป.4 วิทยาศาสตร์ เรื่อง วงจรชีวิตพืช 50 นาที')],
    activeSkillIds: [],
    activeSkillNames: [],
  });

  assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') return;
  assert.equal(result.flowKey, 'education.lesson_plan');
  assert.equal(result.taskFlowDecision.slots.grade_level, 'ป.4');
});

test('resolveLineTaskFlowAction returns ready for agriculture diagnosis when crop and symptoms are present', async () => {
  const result = await resolveLineTaskFlowAction({
    lastUserPrompt: 'มะเขือเทศ ใบเหลือง มีจุดดำ',
    messages: [createTextMessage('user', 'มะเขือเทศ ใบเหลือง มีจุดดำ')],
    activeSkillIds: [],
    activeSkillNames: [],
  });

  assert.equal(result.kind, 'ready');
  if (result.kind !== 'ready') return;
  assert.equal(result.flowKey, 'agriculture.diagnosis');
  assert.equal(result.taskFlowDecision.slots.crop_name, 'มะเขือเทศ');
});
