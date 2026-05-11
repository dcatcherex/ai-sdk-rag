import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatMessage } from '@/features/chat/types';
import { buildResponseCardFromTaskFlow } from '@/features/task-flows/response-format';
import {
  buildTaskFlowMessageState,
  buildTaskFlowReadyPromptBlock,
  resolveTaskFlow,
} from '@/features/task-flows/service';

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

test('resolveTaskFlow returns needs_more_info when diagnosis intent is missing crop_name', async () => {
  const messages = [
    createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย'),
  ];

  const decision = await resolveTaskFlow({
    channel: 'web',
    message: 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย',
    messages,
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(decision.status, 'needs_more_info');
  if (decision.status !== 'needs_more_info') return;

  assert.equal(decision.flowKey, 'agriculture.diagnosis');
  assert.deepEqual(decision.missingSlots, ['crop_name']);
  assert.match(decision.followUpQuestion, /เป็นพืชอะไร/);
});

test('resolveTaskFlow returns ready for crop plus symptoms in one message', async () => {
  const messages = [
    createTextMessage('user', 'มะเขือเทศ ใบเหลือง มีจุดดำ'),
  ];

  const decision = await resolveTaskFlow({
    channel: 'web',
    message: 'มะเขือเทศ ใบเหลือง มีจุดดำ',
    messages,
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(decision.status, 'ready');
  if (decision.status !== 'ready') return;

  assert.equal(decision.flowKey, 'agriculture.diagnosis');
  assert.equal(decision.outputTemplateKey, 'agriculture.diagnosis');
  assert.equal(decision.slots.crop_name, 'มะเขือเทศ');
  assert.match(String(decision.slots.symptoms), /ใบเหลือง/);
});

test('resolveTaskFlow continues slot filling from previous task-flow metadata', async () => {
  const initialDecision = await resolveTaskFlow({
    channel: 'web',
    message: 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย',
    messages: [createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย')],
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(initialDecision.status, 'needs_more_info');
  if (initialDecision.status !== 'needs_more_info') return;

  const followUpState = buildTaskFlowMessageState(initialDecision);
  const continuedMessages = [
    createTextMessage('user', 'ใบเหลือง มีจุดดำ ช่วยดูหน่อย'),
    createTextMessage('assistant', initialDecision.followUpQuestion, { taskFlow: followUpState }),
    createTextMessage('user', 'มะเขือเทศ'),
  ];

  const continuedDecision = await resolveTaskFlow({
    channel: 'web',
    message: 'มะเขือเทศ',
    messages: continuedMessages,
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(continuedDecision.status, 'ready');
  if (continuedDecision.status !== 'ready') return;

  assert.equal(continuedDecision.slots.crop_name, 'มะเขือเทศ');
  assert.match(String(continuedDecision.slots.symptoms), /ใบเหลือง/);
});

test('resolveTaskFlow returns no_match for unrelated chat', async () => {
  const decision = await resolveTaskFlow({
    channel: 'web',
    message: 'ช่วยสรุปประชุมเมื่อเช้าให้หน่อย',
    messages: [createTextMessage('user', 'ช่วยสรุปประชุมเมื่อเช้าให้หน่อย')],
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(decision.status, 'no_match');
});

test('resolveTaskFlow detects education lesson plans from natural teacher requests', async () => {
  const decision = await resolveTaskFlow({
    channel: 'web',
    message: 'Please make a lesson plan for Grade 5 science on plant life cycle for 50 minutes',
    messages: [createTextMessage('user', 'Please make a lesson plan for Grade 5 science on plant life cycle for 50 minutes')],
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'en-US',
  });

  assert.equal(decision.status, 'ready');
  if (decision.status !== 'ready') return;

  assert.equal(decision.flowKey, 'education.lesson_plan');
  assert.equal(decision.outputTemplateKey, 'common.summary');
  assert.equal(decision.slots.grade_level, 'Grade 5');
  assert.equal(decision.slots.duration, '50 minutes');
  assert.match(String(decision.slots.subject), /science/i);
});

test('resolveTaskFlow asks for the next missing field in lesson-plan flows', async () => {
  const decision = await resolveTaskFlow({
    channel: 'web',
    message: 'ช่วยทำแผนการสอนวิทยาศาสตร์ เรื่อง วงจรชีวิตพืช',
    messages: [createTextMessage('user', 'ช่วยทำแผนการสอนวิทยาศาสตร์ เรื่อง วงจรชีวิตพืช')],
    activeSkillIds: [],
    activeSkillNames: [],
    locale: 'th-TH',
  });

  assert.equal(decision.status, 'needs_more_info');
  if (decision.status !== 'needs_more_info') return;

  assert.equal(decision.flowKey, 'education.lesson_plan');
  assert.equal(decision.missingSlots[0], 'grade_level');
});

test('buildResponseCardFromTaskFlow maps a ready diagnosis into the agriculture template', () => {
  const card = buildResponseCardFromTaskFlow({
    decision: {
      status: 'ready',
      flowKey: 'agriculture.diagnosis',
      confidence: 0.92,
      source: 'rule',
      outputTemplateKey: 'agriculture.diagnosis',
      slots: {
        crop_name: 'มะเขือเทศ',
        symptoms: 'ใบเหลือง, จุดดำ',
      },
    },
    assistantText: [
      'ปัญหาที่น่าจะเป็น: โรคใบจุด',
      'ความมั่นใจ: ปานกลาง',
      'ระดับความรุนแรง: สูง',
      'ควรทำทันที: ตัดใบที่เป็นโรคและลดความชื้น',
    ].join('\n'),
    locale: 'th-TH',
  });

  assert.equal(card?.templateKey, 'agriculture.diagnosis');
  assert.equal(card?.data.crop_name, 'มะเขือเทศ');
  assert.equal(card?.data.diagnosis, 'โรคใบจุด');
  assert.equal(card?.data.severity, 'สูง');
});

test('buildResponseCardFromTaskFlow maps a lesson plan into a common summary card', () => {
  const card = buildResponseCardFromTaskFlow({
    decision: {
      status: 'ready',
      flowKey: 'education.lesson_plan',
      confidence: 0.89,
      source: 'rule',
      outputTemplateKey: 'common.summary',
      slots: {
        grade_level: 'Grade 5',
        subject: 'Science - plant life cycle',
        duration: '50 minutes',
      },
    },
    assistantText: 'Lesson title: Plant life cycle\nLearning objectives: Students explain each stage.\nMaterials: Slides and worksheet.',
    locale: 'en-US',
  });

  assert.equal(card?.templateKey, 'common.summary');
  assert.match(String(card?.data.title), /Grade 5/);
  assert.match(String(card?.data.summary), /Learning objectives/);
});

test('buildTaskFlowReadyPromptBlock keeps agriculture guidance advisory and builds a full lesson-plan scaffold', () => {
  const agriculturePrompt = buildTaskFlowReadyPromptBlock({
    status: 'ready',
    flowKey: 'agriculture.diagnosis',
    confidence: 0.8,
    source: 'rule',
    slots: {
      crop_name: 'Tomato',
      symptoms: 'yellow leaves',
    },
    outputTemplateKey: 'agriculture.diagnosis',
  }, 'en-US');

  const lessonPlanPrompt = buildTaskFlowReadyPromptBlock({
    status: 'ready',
    flowKey: 'education.lesson_plan',
    confidence: 0.8,
    source: 'rule',
    slots: {
      grade_level: 'Grade 5',
      subject: 'Science',
      duration: '50 minutes',
    },
    outputTemplateKey: 'common.summary',
  }, 'en-US');

  assert.match(agriculturePrompt, /advisory guidance/i);
  assert.match(agriculturePrompt, /human help/i);
  assert.match(lessonPlanPrompt, /Learning objectives:/);
  assert.match(lessonPlanPrompt, /Teaching sequence:/);
});
