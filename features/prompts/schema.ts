import { z } from 'zod';
import { PROMPT_CATEGORIES } from './constants';

export const createPromptSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  category: z.enum(PROMPT_CATEGORIES),
  tags: z.array(z.string().max(30)).max(10).default([]),
  isPublic: z.boolean().default(false),
});

export const updatePromptSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  category: z.enum(PROMPT_CATEGORIES).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  isPublic: z.boolean().optional(),
});

export type CreatePromptSchema = z.infer<typeof createPromptSchema>;
export type UpdatePromptSchema = z.infer<typeof updatePromptSchema>;
