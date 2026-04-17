import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { deleteComment } from '@/features/collaboration/service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: commentId } = await params;
  await deleteComment(authResult.user.id, commentId);
  return new NextResponse(null, { status: 204 });
}
