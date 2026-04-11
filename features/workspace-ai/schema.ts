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

export type WorkspaceTextAssistRequestInput = z.infer<typeof workspaceTextAssistRequestSchema>;
export type WorkspaceTextAssistOutput = z.infer<typeof workspaceTextAssistOutputSchema>;
export type WorkspaceImageAssistRequestInput = z.infer<typeof workspaceImageAssistRequestSchema>;
