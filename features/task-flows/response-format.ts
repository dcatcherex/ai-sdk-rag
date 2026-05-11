import type { ResponseCard } from '@/features/response-format/types';
import type { TaskFlowDecision } from '@/features/task-flows/types';

type ReadyTaskFlowDecision = Extract<TaskFlowDecision, { status: 'ready' }>;

function readLabeledSection(text: string, labels: string[]): string | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index]!;
    const label = labels.find((candidate) => currentLine.startsWith(candidate));
    if (!label) {
      continue;
    }

    const remainder = currentLine.slice(label.length).trim();
    const collected = [remainder];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      if (/^[A-Za-zก-๙0-9 _()/.-]+:\s*/.test(lines[nextIndex]!)) {
        break;
      }
      collected.push(lines[nextIndex]!);
    }

    return collected.filter(Boolean).join('\n').trim() || null;
  }

  return null;
}

function buildAgricultureDiagnosisResponseCard(input: {
  decision: ReadyTaskFlowDecision;
  assistantText: string;
  locale: string;
}): ResponseCard {
  const cropName = typeof input.decision.slots.crop_name === 'string'
    ? input.decision.slots.crop_name
    : input.locale.startsWith('th')
      ? 'พืช'
      : 'Crop';
  const symptoms = typeof input.decision.slots.symptoms === 'string'
    ? input.decision.slots.symptoms
    : '';
  const diagnosis =
    readLabeledSection(input.assistantText, ['ปัญหาที่น่าจะเป็น:', 'โรค/แมลง:', 'Diagnosis:', 'Likely issue:'])
    ?? readLabeledSection(input.assistantText, ['สรุป:', 'Summary:'])
    ?? symptoms
    ?? (input.locale.startsWith('th') ? 'ต้องตรวจสอบเพิ่มเติม' : 'Needs more review');
  const severity =
    readLabeledSection(input.assistantText, ['ระดับความรุนแรง:', 'ความเสี่ยง:', 'Severity:', 'Risk level:'])
    ?? (input.locale.startsWith('th') ? 'ควรเฝ้าระวัง' : 'Monitor closely');
  const recommendation =
    readLabeledSection(input.assistantText, ['ควรทำทันที:', 'คำแนะนำ:', 'Next steps:', 'Immediate action:'])
    ?? input.assistantText.slice(0, 280);

  return {
    templateKey: 'agriculture.diagnosis',
    altText: input.locale.startsWith('th') ? 'ผลการวินิจฉัยพืช' : 'Plant diagnosis result',
    data: {
      crop_name: String(cropName),
      diagnosis: String(diagnosis),
      severity: String(severity),
      recommendation: String(recommendation),
      altText: input.locale.startsWith('th') ? 'ผลการวินิจฉัยพืช' : 'Plant diagnosis result',
    },
    fallbackText: input.assistantText,
  };
}

function buildEducationLessonPlanResponseCard(input: {
  decision: ReadyTaskFlowDecision;
  assistantText: string;
  locale: string;
}): ResponseCard {
  const gradeLevel = typeof input.decision.slots.grade_level === 'string'
    ? input.decision.slots.grade_level
    : input.locale.startsWith('th')
      ? 'ระดับชั้น'
      : 'Grade level';
  const subject = typeof input.decision.slots.subject === 'string'
    ? input.decision.slots.subject
    : input.locale.startsWith('th')
      ? 'แผนการสอน'
      : 'Lesson plan';

  return {
    templateKey: 'common.summary',
    altText: input.locale.startsWith('th') ? 'สรุปแผนการสอน' : 'Lesson plan summary',
    data: {
      title: `${subject} (${gradeLevel})`,
      summary: input.assistantText.slice(0, 280),
      altText: input.locale.startsWith('th') ? 'สรุปแผนการสอน' : 'Lesson plan summary',
    },
    fallbackText: input.assistantText,
  };
}

export function buildResponseCardFromTaskFlow(input: {
  decision: ReadyTaskFlowDecision;
  assistantText: string;
  locale: string;
}): ResponseCard | null {
  if (input.decision.outputTemplateKey === 'agriculture.diagnosis') {
    return buildAgricultureDiagnosisResponseCard(input);
  }

  if (input.decision.outputTemplateKey === 'common.summary' && input.decision.flowKey === 'education.lesson_plan') {
    return buildEducationLessonPlanResponseCard(input);
  }

  return null;
}
