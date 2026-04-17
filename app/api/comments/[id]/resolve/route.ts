import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { resolveComment } from '@/features/collaboration/service';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: commentId } = await params;
  await resolveComment(commentId, authResult.user.id);
  return new NextResponse(null, { status: 204 });
}
