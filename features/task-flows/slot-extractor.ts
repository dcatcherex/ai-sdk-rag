import type { ChatMessage } from '@/features/chat/types';
import type {
  TaskFlowDefinition,
  TaskFlowMessageState,
  TaskFlowSlotExtractionResult,
} from '@/features/task-flows/types';

type ExtractTaskFlowSlotsInput = {
  flow: TaskFlowDefinition;
  message: string;
  messages: ChatMessage[];
  state?: TaskFlowMessageState | null;
};

const AGRICULTURE_CROPS = [
  'มะเขือเทศ',
  'พริก',
  'ข้าว',
  'แตงโม',
  'ข้าวโพด',
  'ทุเรียน',
  'มันสำปะหลัง',
  'ลำไย',
  'ผัก',
  'tomato',
  'chili',
  'pepper',
  'rice',
  'corn',
  'watermelon',
];

const AGRICULTURE_SYMPTOMS = [
  'ใบเหลือง',
  'จุดดำ',
  'ใบหงิก',
  'เหี่ยว',
  'รากเน่า',
  'รา',
  'yellow leaves',
  'black spots',
  'leaf spot',
  'wilting',
  'root rot',
];

const EDUCATION_GRADE_HINTS = [
  'อนุบาล',
  'ประถม',
  'มัธยม',
  'ป.1',
  'ป.2',
  'ป.3',
  'ป.4',
  'ป.5',
  'ป.6',
  'ม.1',
  'ม.2',
  'ม.3',
  'ม.4',
  'ม.5',
  'ม.6',
  'grade 1',
  'grade 2',
  'grade 3',
  'grade 4',
  'grade 5',
  'grade 6',
  'grade 7',
  'grade 8',
  'grade 9',
  'grade 10',
  'grade 11',
  'grade 12',
];

const EDUCATION_SUBJECT_HINTS = [
  'วิทยาศาสตร์',
  'คณิตศาสตร์',
  'ภาษาไทย',
  'ภาษาอังกฤษ',
  'สังคมศึกษา',
  'ชีววิทยา',
  'science',
  'math',
  'mathematics',
  'english',
  'thai language',
  'biology',
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function readDetectedCrop(message: string): string | null {
  const normalizedMessage = normalize(message);
  const match = AGRICULTURE_CROPS.find((crop) => normalizedMessage.includes(normalize(crop)));
  return match ?? null;
}

function readDetectedSymptoms(message: string): string | null {
  const normalizedMessage = normalize(message);
  const matches = AGRICULTURE_SYMPTOMS.filter((symptom) => normalizedMessage.includes(normalize(symptom)));
  if (matches.length > 0) {
    return matches.join(', ');
  }

  if (/[?]$/.test(message.trim())) {
    return null;
  }

  if (readDetectedCrop(message)) {
    return null;
  }

  return message.trim().length >= 8 ? message.trim() : null;
}

function isLikelyDirectAnswer(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (trimmed.length > 40) return false;
  return !/[?!]/.test(trimmed);
}

function extractAgricultureDiagnosisSlots(input: ExtractTaskFlowSlotsInput): TaskFlowSlotExtractionResult {
  const slots: Record<string, unknown> = {};
  const slotConfidence: Record<string, number> = {};
  const detectedCrop = readDetectedCrop(input.message);
  const detectedSymptoms = readDetectedSymptoms(input.message);

  if (detectedCrop) {
    slots.crop_name = detectedCrop;
    slotConfidence.crop_name = 0.9;
  }

  if (detectedSymptoms) {
    slots.symptoms = detectedSymptoms;
    slotConfidence.symptoms = detectedCrop && normalize(detectedSymptoms) === normalize(detectedCrop) ? 0.2 : 0.86;
  }

  if (input.state?.flowKey === input.flow.key && input.state.missingSlots.includes('crop_name') && !slots.crop_name && isLikelyDirectAnswer(input.message)) {
    slots.crop_name = input.message.trim();
    slotConfidence.crop_name = 0.8;
  }

  if (input.state?.flowKey === input.flow.key && input.state.missingSlots.includes('symptoms') && !slots.symptoms && input.message.trim()) {
    slots.symptoms = input.message.trim();
    slotConfidence.symptoms = 0.78;
  }

  return { slots, slotConfidence };
}

function readEducationGradeLevel(message: string): string | null {
  const regexMatch = message.match(/\b(grade\s*\d{1,2}|ป\.\d|ม\.\d)\b/i);
  if (regexMatch?.[1]) {
    return regexMatch[1];
  }

  const normalizedMessage = normalize(message);
  const directMatch = EDUCATION_GRADE_HINTS.find((hint) => normalizedMessage.includes(normalize(hint)));
  if (directMatch) {
    return directMatch;
  }
  
  return null;
}

function readEducationDuration(message: string): string | null {
  const match = message.match(/(\d{1,3}\s*(?:นาที|minutes|minute|ชั่วโมง|hours|hour|ชม\.)|1\s*คาบ|\d+\s*คาบ)/i);
  return match?.[1] ?? null;
}

function readEducationSubject(message: string): string | null {
  const normalizedMessage = normalize(message);
  const directSubject = EDUCATION_SUBJECT_HINTS.find((hint) => normalizedMessage.includes(normalize(hint)));
  const topicMatch = message.match(/(?:เรื่อง|topic|on)\s+([^\n,.]+)/i)?.[1]?.trim();

  if (directSubject && topicMatch) {
    return `${directSubject} - ${topicMatch}`;
  }

  if (directSubject) {
    return directSubject;
  }

  if (topicMatch && topicMatch.length > 2) {
    return topicMatch;
  }

  return null;
}

function extractEducationLessonPlanSlots(input: ExtractTaskFlowSlotsInput): TaskFlowSlotExtractionResult {
  const slots: Record<string, unknown> = {};
  const slotConfidence: Record<string, number> = {};

  const gradeLevel = readEducationGradeLevel(input.message);
  const subject = readEducationSubject(input.message);
  const duration = readEducationDuration(input.message);

  if (gradeLevel) {
    slots.grade_level = gradeLevel;
    slotConfidence.grade_level = 0.88;
  }

  if (subject) {
    slots.subject = subject;
    slotConfidence.subject = 0.82;
  }

  if (duration) {
    slots.duration = duration;
    slotConfidence.duration = 0.9;
  }

  if (input.state?.flowKey === input.flow.key) {
    if (input.state.missingSlots.includes('grade_level') && !slots.grade_level && isLikelyDirectAnswer(input.message)) {
      slots.grade_level = input.message.trim();
      slotConfidence.grade_level = 0.76;
    }
    if (input.state.missingSlots.includes('subject') && !slots.subject && input.message.trim()) {
      slots.subject = input.message.trim();
      slotConfidence.subject = 0.74;
    }
    if (input.state.missingSlots.includes('duration') && !slots.duration && input.message.trim()) {
      slots.duration = input.message.trim();
      slotConfidence.duration = 0.74;
    }
  }

  return { slots, slotConfidence };
}

export function extractTaskFlowSlots(input: ExtractTaskFlowSlotsInput): TaskFlowSlotExtractionResult {
  switch (input.flow.key) {
    case 'agriculture.diagnosis':
      return extractAgricultureDiagnosisSlots(input);
    case 'education.lesson_plan':
      return extractEducationLessonPlanSlots(input);
    default:
      return { slots: {}, slotConfidence: {} };
  }
}
