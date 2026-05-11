import type { TaskFlowDefinition } from '@/features/task-flows/types';

export const agricultureDiagnosisFlow = {
  key: 'agriculture.diagnosis',
  profession: 'agriculture',
  title: 'Plant diagnosis',
  description: 'Diagnose likely crop disease, pest, or stress from symptoms.',
  triggers: [
    'ใบเหลือง',
    'จุดดำ',
    'ใบหงิก',
    'พืชเป็นอะไร',
    'ช่วยดูอาการ',
    'วิเคราะห์โรคพืช',
    'diagnose plant',
    'plant disease',
    'leaf spot',
    'yellow leaves',
  ],
  negativeTriggers: [
    'แผนการสอน',
    'lesson plan',
    'sales',
  ],
  requiredSlots: [
    {
      key: 'crop_name',
      label: 'Crop',
      type: 'text',
      required: true,
      question: 'เป็นพืชอะไรครับ? ถ้ามีรูปใบที่เป็นอาการ แนบมาได้เลยครับ',
      examples: ['มะเขือเทศ', 'ข้าว', 'พริก'],
    },
    {
      key: 'symptoms',
      label: 'Symptoms',
      type: 'text',
      required: true,
      question: 'อาการหลักคืออะไรครับ เช่น ใบเหลือง จุดดำ เหี่ยว หรือรากเน่า?',
    },
  ],
  optionalSlots: [
    {
      key: 'duration',
      label: 'Duration',
      type: 'text',
      required: false,
      question: 'เริ่มเป็นมานานแค่ไหนครับ?',
    },
    {
      key: 'weather_context',
      label: 'Weather context',
      type: 'text',
      required: false,
      question: 'ช่วงนี้ฝนตกหรือความชื้นสูงไหมครับ?',
    },
  ],
  outputTemplateKey: 'agriculture.diagnosis',
  safetyLevel: 'caution',
  channels: ['web', 'shared_link', 'line'],
} satisfies TaskFlowDefinition;

export const educationLessonPlanFlow = {
  key: 'education.lesson_plan',
  profession: 'education',
  title: 'Lesson plan',
  description: 'Create a classroom lesson plan from a natural-language teacher request.',
  triggers: [
    'แผนการสอน',
    'เตรียมสอน',
    'lesson plan',
    'teaching plan',
    'class plan',
  ],
  negativeTriggers: [
    'ใบเหลือง',
    'จุดดำ',
    'plant disease',
  ],
  requiredSlots: [
    {
      key: 'grade_level',
      label: 'Grade level',
      type: 'text',
      required: true,
      question: 'สอนระดับชั้นไหนครับ?',
      examples: ['ป.4', 'ม.2', 'Grade 5'],
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'text',
      required: true,
      question: 'วิชาและหัวข้อคืออะไรครับ?',
      examples: ['วิทยาศาสตร์ เรื่อง วงจรชีวิตพืช', 'คณิตศาสตร์ เรื่อง เศษส่วน'],
    },
    {
      key: 'duration',
      label: 'Duration',
      type: 'text',
      required: true,
      question: 'คาบนี้ใช้เวลากี่นาทีครับ?',
      examples: ['50 นาที', '1 คาบ', '45 minutes'],
    },
  ],
  optionalSlots: [
    {
      key: 'learning_goal',
      label: 'Learning goal',
      type: 'text',
      required: false,
      question: 'อยากให้ผู้เรียนได้ผลลัพธ์อะไรเป็นพิเศษครับ?',
    },
  ],
  outputTemplateKey: 'common.summary',
  channels: ['web', 'shared_link', 'line'],
} satisfies TaskFlowDefinition;

export const BUILTIN_TASK_FLOW_TEMPLATES: TaskFlowDefinition[] = [
  agricultureDiagnosisFlow,
  educationLessonPlanFlow,
];
