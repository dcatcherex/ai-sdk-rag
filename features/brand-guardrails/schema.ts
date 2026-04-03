import { z } from 'zod';

export const createGuardrailSchema = z.object({
  ruleType: z.enum(['banned_phrase', 'tone_rule', 'compliance_note', 'required_disclosure']),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  pattern: z.string().nullable().default(null),
  severity: z.enum(['block', 'warning', 'info']).default('warning'),
  isActive: z.boolean().default(true),
});

export const updateGuardrailSchema = createGuardrailSchema.partial();

export const checkGuardrailsSchema = z.object({
  content: z.string().min(1),
  brandId: z.string(),
});

export type CreateGuardrailInput = z.infer<typeof createGuardrailSchema>;
export type UpdateGuardrailInput = z.infer<typeof updateGuardrailSchema>;
export type CheckGuardrailsInput = z.infer<typeof checkGuardrailsSchema>;
