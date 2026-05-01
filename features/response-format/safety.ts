import type { ResponseSafety, ResponseSeverity } from '@/features/response-format/types';

type InferResponseSafetyInput = {
  userText?: string;
  responseText: string;
  locale?: string;
};

const THAI_HUMAN_HELP_PATTERN =
  /(ขอ(?:คน|เจ้าหน้าที่|แอดมิน|ผู้เชี่ยวชาญ)|ให้คนช่วย|ติดต่อเจ้าหน้าที่|ส่งต่อ|ให้ผู้เชี่ยวชาญดู|ปรึกษาคน)/i;
const ENGLISH_HUMAN_HELP_PATTERN =
  /\b(?:ask(?:ing)?\s+(?:a\s+)?human|human help|person help|support agent|reviewer|escalate|handoff|manager approval)\b/i;
const THAI_UNCERTAINTY_PATTERN = /(ไม่แน่ใจ|ยังไม่ชัด|ควรตรวจสอบเพิ่มเติม|ข้อมูลไม่พอ)/i;
const ENGLISH_UNCERTAINTY_PATTERN = /\b(?:uncertain|not sure|cannot confirm|need more information|unclear)\b/i;

const SEVERITY_PATTERNS: Array<{ severity: ResponseSeverity; pattern: RegExp }> = [
  { severity: 'critical', pattern: /(?:severity|level|ความรุนแรง)\s*[:：]\s*(?:critical|วิกฤต)/i },
  { severity: 'high', pattern: /(?:severity|level|ความรุนแรง)\s*[:：]\s*(?:high|สูง)/i },
  { severity: 'medium', pattern: /(?:severity|level|ความรุนแรง)\s*[:：]\s*(?:medium|moderate|ปานกลาง)/i },
  { severity: 'low', pattern: /(?:severity|level|ความรุนแรง)\s*[:：]\s*(?:low|ต่ำ)/i },
];

const ESCALATION_PATTERNS = [
  /\b(?:human review|review required|requires escalation|consult a professional|seek urgent care|emergency)\b/i,
  /(ควรส่งต่อ|ต้องให้เจ้าหน้าที่ตรวจ|ให้ผู้เชี่ยวชาญตรวจ|ควรพบแพทย์|กรณีฉุกเฉิน)/i,
];

export function inferResponseSafety({
  userText = '',
  responseText,
}: InferResponseSafetyInput): ResponseSafety | undefined {
  const combinedText = [userText, responseText].filter(Boolean).join('\n');
  if (!combinedText.trim()) return undefined;

  const severity = inferSeverity(combinedText);
  const explicitHumanHelp =
    THAI_HUMAN_HELP_PATTERN.test(userText) || ENGLISH_HUMAN_HELP_PATTERN.test(userText);
  const requiresEscalation =
    explicitHumanHelp
    || severity === 'high'
    || severity === 'critical'
    || ESCALATION_PATTERNS.some((pattern) => pattern.test(combinedText));
  const uncertaintyLabel =
    THAI_UNCERTAINTY_PATTERN.test(responseText) || ENGLISH_UNCERTAINTY_PATTERN.test(responseText)
      ? 'uncertain'
      : undefined;

  if (!severity && !requiresEscalation && !uncertaintyLabel) {
    return undefined;
  }

  return {
    ...(severity ? { severity } : {}),
    ...(requiresEscalation ? { requiresEscalation: true } : {}),
    ...(uncertaintyLabel ? { uncertaintyLabel } : {}),
    notes: buildSafetyNotes({ explicitHumanHelp, severity, requiresEscalation, uncertaintyLabel }),
  };
}

function inferSeverity(text: string): ResponseSeverity | undefined {
  return SEVERITY_PATTERNS.find((entry) => entry.pattern.test(text))?.severity;
}

function buildSafetyNotes(input: {
  explicitHumanHelp: boolean;
  severity?: ResponseSeverity;
  requiresEscalation: boolean;
  uncertaintyLabel?: string;
}): string[] | undefined {
  const notes = [
    ...(input.explicitHumanHelp ? ['user_requested_human_help'] : []),
    ...(input.requiresEscalation && !input.explicitHumanHelp ? ['safety_or_review_escalation'] : []),
    ...(input.severity ? [`severity:${input.severity}`] : []),
    ...(input.uncertaintyLabel ? [`uncertainty:${input.uncertaintyLabel}`] : []),
  ];

  return notes.length > 0 ? notes : undefined;
}
