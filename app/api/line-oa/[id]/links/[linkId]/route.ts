import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { deleteLink } from '@/features/line-oa/link/service';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { linkId } = await params;
  await deleteLink(linkId, authResult.user.id);
  return NextResponse.json({ ok: true });
}
