import type { ChatMessage } from '@/features/chat/types';
import { buildTaskFlowFollowUpQuestion, getMissingRequiredTaskFlowSlots } from '@/features/task-flows/follow-up';
import { detectTaskFlowIntent } from '@/features/task-flows/intent-detector';
import { getTaskFlowDefinitionByKey, getTaskFlowDefinitions } from '@/features/task-flows/registry';
import { extractTaskFlowSlots } from '@/features/task-flows/slot-extractor';
import { getLatestTaskFlowState, mergeTaskFlowSlots } from '@/features/task-flows/state';
import type {
  TaskFlowChannel,
  TaskFlowDecision,
  TaskFlowMessageState,
} from '@/features/task-flows/types';

export async function resolveTaskFlow(input: {
  channel: TaskFlowChannel;
  message: string;
  messages: ChatMessage[];
  activeSkillIds: string[];
  activeSkillNames: string[];
  locale?: string;
}): Promise<TaskFlowDecision> {
  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) {
    return { status: 'no_match', confidence: 0, source: 'fallback' };
  }

  const state = getLatestTaskFlowState(input.messages);
  const candidateFlows = getTaskFlowDefinitions({
    channel: input.channel,
    activeSkillIds: input.activeSkillIds,
    activeSkillNames: input.activeSkillNames,
  });

  const intentMatch = detectTaskFlowIntent({
    message: trimmedMessage,
    flows: candidateFlows,
    state,
  });

  const flow = intentMatch.flow ?? (state ? getTaskFlowDefinitionByKey(state.flowKey) : null);
  if (!flow || intentMatch.confidence < 0.45) {
    return { status: 'no_match', confidence: intentMatch.confidence, source: intentMatch.source };
  }

  const extraction = extractTaskFlowSlots({
    flow,
    message: trimmedMessage,
    messages: input.messages,
    state,
  });
  const mergedSlots = mergeTaskFlowSlots(
    state?.flowKey === flow.key ? state.slots : {},
    extraction.slots,
  );
  const missingSlots = getMissingRequiredTaskFlowSlots(flow, mergedSlots);

  if (missingSlots.length > 0) {
    return {
      status: 'needs_more_info',
      flowKey: flow.key,
      confidence: intentMatch.confidence,
      source: intentMatch.source,
      slots: mergedSlots,
      missingSlots,
      followUpQuestion: buildTaskFlowFollowUpQuestion(flow, missingSlots),
      outputTemplateKey: flow.outputTemplateKey,
      toolName: flow.toolName,
    };
  }

  return {
    status: 'ready',
    flowKey: flow.key,
    confidence: intentMatch.confidence,
    source: intentMatch.source,
    slots: mergedSlots,
    outputTemplateKey: flow.outputTemplateKey,
    toolName: flow.toolName,
  };
}

export function buildTaskFlowMessageState(
  decision: Extract<TaskFlowDecision, { status: 'needs_more_info' | 'ready' }>,
): TaskFlowMessageState {
  return {
    flowKey: decision.flowKey,
    status: decision.status,
    slots: decision.slots,
    missingSlots: decision.status === 'needs_more_info' ? decision.missingSlots : [],
    updatedAt: new Date().toISOString(),
  };
}

export function buildTaskFlowReadyPromptBlock(
  decision: Extract<TaskFlowDecision, { status: 'ready' }>,
  locale = 'th-TH',
): string {
  if (decision.flowKey === 'agriculture.diagnosis') {
    const cropName = typeof decision.slots.crop_name === 'string' ? decision.slots.crop_name : '';
    const symptoms = typeof decision.slots.symptoms === 'string' ? decision.slots.symptoms : '';

    if (locale.startsWith('th')) {
      return [
        'Task flow: agriculture.diagnosis',
        'ตอบแบบกระชับ ช่วยเหลือจริง และระบุความไม่แน่ใจอย่างเหมาะสม',
        'นี่เป็นคำแนะนำเบื้องต้นเพื่อช่วยเกษตรกรตัดสินใจขั้นถัดไป ไม่ใช่การวินิจฉัยยืนยัน',
        'หลีกเลี่ยงภาษาฟันธงเกินไป และชวนให้ตรวจสอบกับเจ้าหน้าที่หรือผู้เชี่ยวชาญเมื่อความเสี่ยงสูง',
        'ข้อมูลที่มี:',
        `- crop_name: ${cropName}`,
        `- symptoms: ${symptoms}`,
        'ให้จัดรูปแบบคำตอบตามหัวข้อต่อไปนี้ทุกครั้ง:',
        'ปัญหาที่น่าจะเป็น:',
        'ความมั่นใจ:',
        'ระดับความรุนแรง:',
        'ควรทำทันที:',
        'สิ่งที่ควรติดตาม:',
        'ควรขอความช่วยเหลือเมื่อ:',
      ].join('\n');
    }

    return [
      'Task flow: agriculture.diagnosis',
      'Respond concisely, be practical, and state uncertainty honestly.',
      'This is advisory guidance for a farmer, not a definitive diagnosis.',
      'Avoid overconfident language and recommend human review when risk appears high.',
      'Known information:',
      `- crop_name: ${cropName}`,
      `- symptoms: ${symptoms}`,
      'Format the answer using these headings every time:',
      'Likely issue:',
      'Confidence:',
      'Severity:',
      'Immediate action:',
      'What to monitor:',
      'When to seek human help:',
    ].join('\n');
  }

  if (decision.flowKey === 'education.lesson_plan') {
    const gradeLevel = typeof decision.slots.grade_level === 'string' ? decision.slots.grade_level : '';
    const subject = typeof decision.slots.subject === 'string' ? decision.slots.subject : '';
    const duration = typeof decision.slots.duration === 'string' ? decision.slots.duration : '';

    if (locale.startsWith('th')) {
      return [
        'Task flow: education.lesson_plan',
        'สร้างแผนการสอนที่ใช้งานได้จริงสำหรับครูไทย',
        'ค่าเริ่มต้นที่ต้องการคือแผนแบบครบถ้วน แต่ยังอ่านง่ายและนำไปใช้ได้ทันที',
        'ข้อมูลที่มี:',
        `- grade_level: ${gradeLevel}`,
        `- subject: ${subject}`,
        `- duration: ${duration}`,
        'ให้จัดคำตอบตามหัวข้อต่อไปนี้ทุกครั้ง:',
        'หัวข้อบทเรียน:',
        'ระดับชั้น:',
        'ระยะเวลา:',
        'จุดประสงค์การเรียนรู้:',
        'สื่อ/อุปกรณ์:',
        'ลำดับกิจกรรมการสอน:',
        'การประเมินผล:',
        'การบ้านหรือกิจกรรมต่อยอด:',
      ].join('\n');
    }

    return [
      'Task flow: education.lesson_plan',
      'Create a practical, classroom-ready lesson plan.',
      'Default to a complete plan that is still easy for a teacher to scan and use immediately.',
      'Known information:',
      `- grade_level: ${gradeLevel}`,
      `- subject: ${subject}`,
      `- duration: ${duration}`,
      'Format the answer using these headings every time:',
      'Lesson title:',
      'Grade level:',
      'Duration:',
      'Learning objectives:',
      'Materials:',
      'Teaching sequence:',
      'Assessment:',
      'Homework or extension:',
    ].join('\n');
  }

  return '';
}
