import { z } from 'zod';

const starterTaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  prompt: z.string().min(1).max(2000),
  icon: z.enum(['calendar', 'chart', 'edit', 'mail', 'message', 'refresh', 'search', 'sparkles']),
  priority: z.enum(['primary', 'secondary']),
});

export const createAgentInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Name for the new agent'),
  systemPrompt: z
    .string()
    .min(1)
    .describe('System prompt that defines the agent personality and behavior'),
  description: z.string().optional().describe('Short description of what this agent does'),
  modelId: z.string().optional().describe('Model ID to use (optional, defaults to platform default)'),
  starterTasks: z
    .array(starterTaskSchema)
    .max(10)
    .optional()
    .describe('Structured starter tasks shown before the first chat message'),
});

export const listAgentsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Maximum number of agents to return'),
});

export const getAgentInputSchema = z.object({
  agentId: z.string().optional().describe('Agent ID to look up'),
  agentName: z.string().optional().describe('Agent name to search for (partial match)'),
});

export const installSkillInputSchema = z.object({
  name: z.string().min(1).max(100).describe('Name for the skill'),
  description: z.string().optional().describe('What this skill does and when to use it'),
  promptFragment: z
    .string()
    .min(1)
    .describe('The skill instructions that will be injected into the system prompt'),
  agentId: z.string().optional().describe('Agent ID to attach this skill to (optional)'),
  triggerType: z
    .enum(['always', 'keyword', 'slash'])
    .optional()
    .default('keyword')
    .describe('When this skill activates'),
  trigger: z.string().optional().describe('Keyword or slash command that triggers this skill'),
});

export const listSkillsInputSchema = z.object({
  category: z.string().optional().describe('Filter by skill category'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Maximum number of skills to return'),
});

export const createThreadInputSchema = z.object({
  agentId: z.string().optional().describe('Agent ID to start the thread with'),
  title: z.string().max(100).optional().describe('Thread title'),
  initialMessage: z
    .string()
    .max(500)
    .optional()
    .describe('Initial message to start the thread (shown to user, not auto-sent)'),
});

export const listThreadsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of threads to return'),
  agentId: z.string().optional().describe('Filter threads by agent ID'),
});

export const continueThreadInputSchema = z.object({
  threadId: z.string().optional().describe('Thread ID to continue'),
  topic: z
    .string()
    .optional()
    .describe('Topic or keyword to search for in thread titles'),
});

export const getUsageInputSchema = z.object({});

export const addTeamMemberInputSchema = z.object({
  email: z.string().email().describe('Email address of the person to invite'),
  creditsToShare: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Number of credits to share with this team member'),
  confirmed: z
    .boolean()
    .optional()
    .default(false)
    .describe('Confirm the action (must be true to proceed)'),
});

export const configRichMenuInputSchema = z.object({
  channelId: z.string().describe('LINE OA channel ID to update'),
  buttonIndex: z
    .number()
    .int()
    .min(0)
    .describe('Zero-based index of the button area to change'),
  agentId: z.string().describe('Agent ID to assign to this button'),
  confirmed: z
    .boolean()
    .optional()
    .default(false)
    .describe('Confirm the change (must be true to execute; false shows a preview)'),
});
