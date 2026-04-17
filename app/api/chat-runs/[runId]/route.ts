import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { getChatRunById } from '@/features/chat/audit/queries';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { runId } = await context.params;

  try {
    const run = await getChatRunById(runId, authResult.user.id);
    if (!run) {
      return NextResponse.json({ error: 'Chat run not found' }, { status: 404 });
    }
    return NextResponse.json(run);
  } catch (error) {
    console.error('Chat run detail query failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat run' },
      { status: 500 },
    );
  }
}
