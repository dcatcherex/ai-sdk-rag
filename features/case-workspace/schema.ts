import { z } from 'zod';

export const caseWorkspaceRecordSchema = z.record(z.string(), z.unknown());

export const caseWorkspaceProfileStatusSchema = z.enum(['active', 'archived']);
export const caseWorkspaceEntityStatusSchema = z.enum(['active', 'archived']);
export const caseStatusSchema = z.enum(['new', 'in_progress', 'waiting', 'done', 'archived']);
export const casePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const taskStatusSchema = z.enum(['todo', 'doing', 'done', 'cancelled']);
export const caseSourceSchema = z.enum(['web', 'chat', 'line', 'manual']);

export const createWorkspaceProfileInputSchema = z.object({
  domain: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  locale: z.string().max(20).optional(),
  status: caseWorkspaceProfileStatusSchema.optional(),
  brandId: z.string().nullable().optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const createContactInputSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(200),
  status: caseWorkspaceEntityStatusSchema.optional(),
  data: caseWorkspaceRecordSchema.optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const updateContactInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: caseWorkspaceEntityStatusSchema.optional(),
  data: caseWorkspaceRecordSchema.optional(),
  description: z.string().max(1000).nullable().optional(),
});

export const createCaseInputSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(200),
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  contactId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const updateCaseInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  contactId: z.string().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const createTaskInputSchema = z.object({
  profileId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  status: taskStatusSchema.optional(),
  dueAt: z.string().datetime().optional(),
  assigneeUserId: z.string().optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const updateTaskInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: taskStatusSchema.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const createTimelineNoteInputSchema = z.object({
  profileId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  body: z.string().max(10000).optional(),
  kind: z.enum(['note', 'message_summary', 'file_link', 'ai_action']).optional(),
  data: caseWorkspaceRecordSchema.optional(),
});

export const searchCasesInputSchema = z.object({
  profileId: z.string().optional(),
  query: z.string().max(300).optional(),
  status: caseStatusSchema.optional(),
  priority: casePrioritySchema.optional(),
  source: caseSourceSchema.optional(),
  dueSoon: z.boolean().optional(),
  waitingOnReply: z.boolean().optional(),
  assignedToMe: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(25),
});

export const getCaseContextInputSchema = z.object({
  caseId: z.string().min(1),
});

export const summarizeCaseInputSchema = z.object({
  caseId: z.string().min(1),
});

export const getCaseWorkspaceDashboardInputSchema = z.object({
  profileId: z.string().min(1),
});

export const assignCaseInputSchema = z.object({
  assigneeUserId: z.string().nullable().optional(),
});

export const exportCaseWorkspaceInputSchema = z.object({
  profileId: z.string().min(1),
  format: z.enum(['csv', 'pdf']).default('csv'),
});
