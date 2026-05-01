import { z } from 'zod';

export const activityRecordMetadataSchema = z
  .object({
    profileId: z.string().optional().describe('Optional domain profile ID linked to this record'),
    entityIds: z.array(z.string()).optional().describe('Optional related domain entity IDs'),
    entityType: z.string().optional().describe('Optional primary entity type such as plot or crop_cycle'),
    source: z.string().optional().describe('Optional source label such as chat, line, or manual'),
  })
  .catchall(z.unknown());

export const logActivityInputSchema = z.object({
  contextType: z
    .string()
    .describe("Domain context, e.g. 'farm', 'class', 'patient'"),
  category: z
    .string()
    .optional()
    .describe("Activity category, e.g. 'fertilizer', 'pesticide', 'harvest', 'lesson'"),
  entity: z
    .string()
    .optional()
    .describe('The subject being logged - crop name, student name, patient ID, etc.'),
  date: z
    .string()
    .describe('Activity date in YYYY-MM-DD format. Default to today if not specified.'),
  activity: z.string().describe('What was done, in plain language'),
  quantity: z.string().optional().describe('Amount and unit, e.g. "50 kg", "2 rai", "3 hours"'),
  cost: z.number().optional().describe('Money spent (in local currency)'),
  income: z.number().optional().describe('Money received from sale or service'),
  notes: z.string().optional().describe('Any additional observations or notes'),
  metadata: activityRecordMetadataSchema
    .optional()
    .describe('Optional structured linkage to a domain profile or entities'),
});

export type LogActivityInput = z.infer<typeof logActivityInputSchema>;

export const getRecordsInputSchema = z.object({
  contextType: z.string().describe("Domain context, e.g. 'farm', 'class', 'patient'"),
  entity: z.string().optional().describe('Filter by subject (crop, student, patient)'),
  category: z.string().optional().describe('Filter by activity category'),
  startDate: z.string().optional().describe('Start date YYYY-MM-DD (inclusive)'),
  endDate: z.string().optional().describe('End date YYYY-MM-DD (inclusive)'),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type GetRecordsInput = z.infer<typeof getRecordsInputSchema>;

export const summarizeRecordsInputSchema = z.object({
  contextType: z.string().describe("Domain context, e.g. 'farm', 'class', 'patient'"),
  entity: z.string().optional().describe('Filter by subject'),
  period: z
    .enum(['week', 'month', 'all'])
    .optional()
    .default('week')
    .describe("Summary period: 'week' = last 7 days, 'month' = last 30 days, 'all' = all time"),
});

export type SummarizeRecordsInput = z.infer<typeof summarizeRecordsInputSchema>;

export const activityRecordRowSchema = z.object({
  id: z.string(),
  contextType: z.string(),
  category: z.string().nullable(),
  entity: z.string().nullable(),
  date: z.string(),
  activity: z.string(),
  quantity: z.string().nullable(),
  cost: z.string().nullable(),
  income: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export type ActivityRecordRow = z.infer<typeof activityRecordRowSchema>;
