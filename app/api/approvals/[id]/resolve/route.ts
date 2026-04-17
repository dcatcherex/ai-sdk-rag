import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { resolveApprovalRequest } from '@/features/collaboration/service';

const resolveSchema = z.object({
  status: z.enum(['approved', 'rejected', 'changes_requested']),
  note: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json();
  const result = resolveSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  try {
    const updated = await resolveApprovalRequest(id, authResult.user.id, {
      status: result.data.status,
      note: result.data.note,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve';
    return new NextResponse(message, { status: 400 });
  }
}
