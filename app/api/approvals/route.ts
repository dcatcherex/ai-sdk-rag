import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getApprovalQueue, createApprovalRequest } from '@/features/collaboration/service';

const createApprovalSchema = z.object({
  contentPieceId: z.string(),
  brandId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const brandId = req.nextUrl.searchParams.get('brandId');
  if (!brandId) return new NextResponse('brandId is required', { status: 400 });

  const queue = await getApprovalQueue(brandId, session.user.id);
  return NextResponse.json(queue);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = createApprovalSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const approval = await createApprovalRequest({
    contentPieceId: result.data.contentPieceId,
    brandId: result.data.brandId ?? null,
    requesterId: session.user.id,
    assigneeId: result.data.assigneeId ?? null,
    dueAt: result.data.dueAt ? new Date(result.data.dueAt) : null,
  });
  return NextResponse.json(approval, { status: 201 });
}
