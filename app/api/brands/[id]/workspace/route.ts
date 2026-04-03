import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getWorkspaceMembers, addWorkspaceMember } from '@/features/collaboration/service';

const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'writer', 'editor', 'reviewer']).default('writer'),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: brandId } = await params;
  const members = await getWorkspaceMembers(brandId);
  return NextResponse.json(members);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: brandId } = await params;
  const body = await req.json();
  const result = addMemberSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const member = await addWorkspaceMember(
    brandId,
    result.data.userId,
    result.data.role,
    session.user.id,
  );
  return NextResponse.json(member, { status: 201 });
}
