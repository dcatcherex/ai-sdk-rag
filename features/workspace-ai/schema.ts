import { z } from 'zod';

export const workspaceAssistEntityTypeSchema = z.enum(['agent', 'skill']);

export const workspaceTextAssistKindSchema = z.enum([
  'agent-description',
  'agent-starters',
  'skill-description',
]);

export const workspaceImageAssistKindSchema = z.enum([
  'agent-cover',
]);

export const workspaceTextAssistContextSchema = z.object({
  entityId: z.string().min(1).optional(),
  entityType: workspaceAssistEntityTypeSchema,
  name: z.string().min(1).max(200).optional(),
  systemPrompt: z.string().min(1).max(20000).optional(),
  promptFragment: z.string().min(1).max(20000).optional(),
  currentValue: z.string().max(20000).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export const workspaceTextAssistRequestSchema = z.object({
  kind: workspaceTextAssistKindSchema,
  targetLocale: z.string().min(2).max(16).default('th'),
  tone: z.string().min(1).max(100).optional(),
  instruction: z.string().min(1).max(1000).optional(),
  context: workspaceTextAssistContextSchema,
});

export const workspaceTextAssistOutputSchema = z.object({
  suggestions: z.array(z.string().min(1).max(280)).min(1).max(4),
});

export const workspaceImageAssistRequestSchema = z.object({
  kind: workspaceImageAssistKindSchema,
  instruction: z.string().min(1).max(1000).optional(),
  modelId: z.string().min(1).max(200).optional(),
  aspectRatio: z.string().min(1).max(20).default('1:1'),
  context: workspaceTextAssistContextSchema,
});

export const workspaceAiRunStatusSchema = z.enum([
  'pending',
  'success',
  'error',
]);

export const workspaceAiRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const workspaceAiRunsSummaryItemSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const workspaceAiRunListItemSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  route: z.enum(['text', 'image']),
  status: workspaceAiRunStatusSchema,
  entityType: workspaceAssistEntityTypeSchema,
  entityId: z.string().nullable(),
  modelId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable(),
});

export const workspaceAiRunsResponseSchema = z.object({
  summary: z.object({
    totalRuns: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    byKind: z.array(workspaceAiRunsSummaryItemSchema),
    byRoute: z.array(workspaceAiRunsSummaryItemSchema),
  }),
  runs: z.array(workspaceAiRunListItemSchema),
});

export type WorkspaceTextAssistRequestInput = z.infer<typeof workspaceTextAssistRequestSchema>;
export type WorkspaceTextAssistOutput = z.infer<typeof workspaceTextAssistOutputSchema>;
export type WorkspaceImageAssistRequestInput = z.infer<typeof workspaceImageAssistRequestSchema>;
export type WorkspaceAiRunsQueryInput = z.infer<typeof workspaceAiRunsQuerySchema>;
export type WorkspaceAiRunsResponse = z.infer<typeof workspaceAiRunsResponseSchema>;
