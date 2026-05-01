import { z } from 'zod';

export const createApprovalRequestInputSchema = z.object({
  contentPieceId: z
    .string()
    .min(1)
    .describe('The content piece ID to submit for approval or review.'),
  brandId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Optional brand or workspace ID for the approval flow.'),
  assigneeId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('Optional reviewer user ID. Leave empty to submit to the shared queue.'),
  dueAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe('Optional ISO timestamp deadline for the approval request.'),
});
