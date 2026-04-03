export type GuardrailRuleType = 'banned_phrase' | 'tone_rule' | 'compliance_note' | 'required_disclosure';
export type GuardrailSeverity = 'block' | 'warning' | 'info';

export type BrandGuardrail = {
  id: string;
  brandId: string;
  ruleType: GuardrailRuleType;
  title: string;
  description: string | null;
  pattern: string | null;
  severity: GuardrailSeverity;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GuardrailViolation = {
  ruleId: string;
  title: string;
  severity: GuardrailSeverity;
  excerpt: string | null;
  suggestion: string | null;
};

export type GuardrailCheckResult = {
  passed: boolean;
  violations: GuardrailViolation[];
};
