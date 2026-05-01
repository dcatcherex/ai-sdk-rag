import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { createApprovalRequestInputSchema } from '@/features/collaboration/schema';
import { createApprovalRequest } from '@/features/collaboration/service';

export function createCollaborationAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    create_approval_request: tool({
      description:
        'Submit a saved content piece for human approval or review. Use this when the user asks to send work for approval, sign-off, or teammate review.',
      needsApproval: true,
      inputSchema: createApprovalRequestInputSchema,
      async execute(input) {
        const approval = await createApprovalRequest({
          contentPieceId: input.contentPieceId,
          brandId: input.brandId ?? null,
          requesterId: userId,
          assigneeId: input.assigneeId ?? null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        });

        return {
          success: true,
          kind: 'approval_request_created',
          id: approval.id,
          approvalRequestId: approval.id,
          contentPieceId: approval.contentPieceId,
          contentPieceTitle: approval.contentPieceTitle ?? null,
          brandId: approval.brandId,
          requesterId: approval.requesterId,
          assigneeId: approval.assigneeId,
          assigneeName: approval.assigneeName ?? null,
          dueAt: approval.dueAt ? approval.dueAt.toISOString() : null,
          status: approval.status,
          createdAt: approval.createdAt.toISOString(),
        };
      },
    }),
  };
}
