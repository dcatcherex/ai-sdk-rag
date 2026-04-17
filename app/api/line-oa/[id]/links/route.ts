import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { generateLinkToken, listLinks } from '@/features/line-oa/link/service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: channelId } = await params;
  const links = await listLinks(channelId, authResult.user.id);
  return NextResponse.json(links);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id: channelId } = await params;
  const result = await generateLinkToken(channelId, authResult.user.id);
  return NextResponse.json(result, { status: 201 });
}
