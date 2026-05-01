import type { ResponseFormat, ResponseIntent } from '@/features/response-format/types';

export type ResponseContractEscalation = 'supported' | 'required' | 'none';
export type ResponseContractSource = 'frontmatter' | 'markdown_section';

export type SkillResponseContract = {
  intent: ResponseIntent;
  defaultFormat?: ResponseFormat;
  cardTemplate?: string;
  escalation?: ResponseContractEscalation;
  requiredSections?: string[];
  source: ResponseContractSource;
};

export type ResponseIntentDefinition = {
  intent: ResponseIntent;
  label: string;
  defaultFormats: ResponseFormat[];
};

export const RESPONSE_INTENT_REGISTRY: Record<ResponseIntent, ResponseIntentDefinition> = {
  answer: { intent: 'answer', label: 'Answer', defaultFormats: ['plain_text'] },
  advisory: { intent: 'advisory', label: 'Advisory', defaultFormats: ['structured_text'] },
  diagnosis: { intent: 'diagnosis', label: 'Diagnosis', defaultFormats: ['structured_text', 'card'] },
  risk_summary: { intent: 'risk_summary', label: 'Risk Summary', defaultFormats: ['structured_text', 'card'] },
  record_confirmation: { intent: 'record_confirmation', label: 'Record Confirmation', defaultFormats: ['structured_text', 'quick_replies'] },
  record_saved: { intent: 'record_saved', label: 'Record Saved', defaultFormats: ['card', 'structured_text'] },
  market_guidance: { intent: 'market_guidance', label: 'Market Guidance', defaultFormats: ['structured_text', 'card'] },
  lesson_plan: { intent: 'lesson_plan', label: 'Lesson Plan', defaultFormats: ['structured_text', 'card'] },
  student_support: { intent: 'student_support', label: 'Student Support', defaultFormats: ['structured_text', 'card'] },
  patient_follow_up: { intent: 'patient_follow_up', label: 'Patient Follow Up', defaultFormats: ['structured_text', 'card'] },
  client_follow_up: { intent: 'client_follow_up', label: 'Client Follow Up', defaultFormats: ['structured_text', 'card'] },
  content_plan: { intent: 'content_plan', label: 'Content Plan', defaultFormats: ['structured_text', 'card'] },
  approval_request: { intent: 'approval_request', label: 'Approval Request', defaultFormats: ['workflow', 'quick_replies'] },
  escalation: { intent: 'escalation', label: 'Escalation', defaultFormats: ['workflow', 'structured_text'] },
  broadcast: { intent: 'broadcast', label: 'Broadcast', defaultFormats: ['structured_text', 'workflow'] },
  unknown: { intent: 'unknown', label: 'Unknown', defaultFormats: ['plain_text'] },
};

const RESPONSE_FORMAT_SET = new Set<ResponseFormat>([
  'plain_text',
  'structured_text',
  'quick_replies',
  'card',
  'workflow',
]);

const RESPONSE_INTENT_SET = new Set<ResponseIntent>(Object.keys(RESPONSE_INTENT_REGISTRY) as ResponseIntent[]);
const ESCALATION_SET = new Set<ResponseContractEscalation>(['supported', 'required', 'none']);

export function normalizeResponseIntent(value: string | undefined): ResponseIntent | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_') as ResponseIntent;
  return RESPONSE_INTENT_SET.has(normalized) ? normalized : null;
}

export function normalizeResponseFormat(value: string | undefined): ResponseFormat | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_') as ResponseFormat;
  return RESPONSE_FORMAT_SET.has(normalized) ? normalized : null;
}

export function normalizeResponseContractEscalation(
  value: string | undefined,
): ResponseContractEscalation | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_') as ResponseContractEscalation;
  return ESCALATION_SET.has(normalized) ? normalized : null;
}

export function normalizeRequiredSections(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(/[,\n]/)
    .map((section) => section.trim().toLowerCase().replace(/[\s-]+/g, '_'))
    .filter(Boolean);
}

export function dedupeSkillResponseContracts(
  contracts: SkillResponseContract[],
): SkillResponseContract[] {
  const seen = new Set<string>();

  return contracts.filter((contract) => {
    const key = [
      contract.intent,
      contract.defaultFormat ?? '',
      contract.cardTemplate ?? '',
      contract.escalation ?? '',
      (contract.requiredSections ?? []).join(','),
    ].join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
