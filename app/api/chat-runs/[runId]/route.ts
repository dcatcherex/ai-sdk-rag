import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getChatRunById } from '@/features/chat/audit/queries';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await context.params;

  try {
    const run = await getChatRunById(runId, session.user.id);
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
