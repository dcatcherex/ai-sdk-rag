import { z } from 'zod';

const changeBase = {
  id: z.string().min(1).max(80),
  title: z.string().max(120),
  rationale: z.string().max(400),
  section: z.string(),
};

const structuralChangeSchema = z.object({
  ...changeBase,
  type: z.literal('structural'),
  risk: z.literal('low'),
  target: z.enum(['agent', 'skill_attachment', 'tool_attachment']),
  field: z.string().min(1).max(60),
  currentValue: z.unknown(),
  suggestedValue: z.unknown(),
  skillId: z.string().optional(),
  userToolId: z.string().optional(),
});

const systemPromptChangeSchema = z.object({
  ...changeBase,
  type: z.literal('system_prompt'),
  risk: z.literal('high'),
  before: z.string(),
  after: z.string().min(1),
});

const skillForkChangeSchema = z.object({
  ...changeBase,
  type: z.literal('skill_fork'),
  risk: z.literal('medium'),
  originalSkillId: z.string().min(1),
  originalSkillName: z.string(),
  improvedPromptFragment: z.string().min(1),
  descriptionImproved: z.string().max(1024).optional(),
});

const skillNewChangeSchema = z.object({
  ...changeBase,
  type: z.literal('skill_new'),
  risk: z.literal('medium'),
  skillName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  skillDescription: z.string().max(1024),
  promptFragment: z.string().min(1),
  activationMode: z.enum(['rule', 'model']),
  triggerType: z.enum(['slash', 'keyword', 'always']),
  trigger: z.string().max(100),
});

const toolOptimizeChangeSchema = z.object({
  ...changeBase,
  type: z.literal('tool_optimize'),
  risk: z.literal('medium'),
  userToolId: z.string().min(1),
  toolName: z.string(),
  descriptionBefore: z.string(),
  descriptionAfter: z.string().min(1),
  parameterChanges: z.array(z.object({
    paramName: z.string().min(1),
    descriptionBefore: z.string(),
    descriptionAfter: z.string().min(1),
  })),
});

export const improvementPlanSchema = z.object({
  agentId: z.string(),
  estimatedScoreAfter: z.number().int().min(0).max(100),
  reasoning: z.string().max(500),
  changes: z.array(
    z.discriminatedUnion('type', [
      structuralChangeSchema,
      systemPromptChangeSchema,
      skillForkChangeSchema,
      skillNewChangeSchema,
      toolOptimizeChangeSchema,
    ]),
  ).max(20),
});
