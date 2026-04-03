import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { updateWorkspaceMemberRole, removeWorkspaceMember } from '@/features/collaboration/service';

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'writer', 'editor', 'reviewer']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: brandId, userId } = await params;
  const body = await req.json();
  const result = updateRoleSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  await updateWorkspaceMemberRole(brandId, userId, result.data.role);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: brandId, userId } = await params;
  await removeWorkspaceMember(brandId, userId);
  return new NextResponse(null, { status: 204 });
}
