import { NextResponse } from 'next/server';

import { requireUser } from "@/lib/auth-server";
import { usePublishedAgentTemplate } from '@/features/agents/server/catalog';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;
  const copy = await usePublishedAgentTemplate(authResult.user.id, id);
  if (!copy) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ agent: copy }, { status: 201 });
}
