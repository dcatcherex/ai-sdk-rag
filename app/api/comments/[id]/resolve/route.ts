import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveComment } from '@/features/collaboration/service';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: commentId } = await params;
  await resolveComment(commentId, session.user.id);
  return new NextResponse(null, { status: 204 });
}
