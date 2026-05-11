import { z } from 'zod';

export const taskFlowChannelSchema = z.enum(['web', 'shared_link', 'line']);

export const taskFlowSlotTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'location',
  'image',
  'enum',
  'boolean',
]);

export const taskFlowSlotDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: taskFlowSlotTypeSchema,
  required: z.boolean(),
  question: z.string().min(1),
  examples: z.array(z.string().min(1)).optional(),
  extractionHints: z.array(z.string().min(1)).optional(),
  enumValues: z.array(z.string().min(1)).optional(),
});

export const taskFlowDefinitionSchema = z.object({
  key: z.string().min(1),
  skillKey: z.string().min(1).optional(),
  profession: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  triggers: z.array(z.string().min(1)).min(1),
  negativeTriggers: z.array(z.string().min(1)).optional(),
  requiredSlots: z.array(taskFlowSlotDefinitionSchema).min(1),
  optionalSlots: z.array(taskFlowSlotDefinitionSchema).optional(),
  outputTemplateKey: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  safetyLevel: z.enum(['normal', 'caution', 'high_stakes']).optional(),
  channels: z.array(taskFlowChannelSchema).optional(),
});
